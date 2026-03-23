import { extractText } from "unpdf";
import { z } from "zod";
import { createLangChainChatModelForUseCase } from "@interviewclaw/ai-runtime";
import { createClient } from "@/lib/supabase/server";
import { userProfileService } from "@/lib/user-profile-service";
import { logResumeStage, resumeLogger } from "@/lib/resume-parsing-logger";

const resumeSchema = z.object({
  personalInfo: z
    .object({
      name: z.string().nullish(),
      email: z.string().nullish(),
      phone: z.string().nullish(),
    })
    .nullish(),
  jobIntention: z.string().nullish(),
  experienceYears: z.number().nullish(),
  skills: z.array(z.string()).nullish(),
  education: z
    .object({
      school: z.string().nullish(),
      major: z.string().nullish(),
      degree: z.string().nullish(),
      graduationDate: z.string().nullish(),
    })
    .nullish(),
  workExperiences: z
    .array(
      z.object({
        company: z.string(),
        position: z.string(),
        startDate: z.string().nullish(),
        endDate: z.string().nullish(),
        description: z.string(),
      }),
    )
    .nullish(),
  projectExperiences: z
    .array(
      z.object({
        projectName: z.string(),
        role: z.string().nullish(),
        startDate: z.string().nullish(),
        endDate: z.string().nullish(),
        techStack: z.array(z.string()).nullish(),
        description: z.string(),
      }),
    )
    .nullish(),
});

export type ResumeData = z.infer<typeof resumeSchema>;

async function parsePdfBuffer(
  fileBuffer: ArrayBuffer,
  metadata?: { fileName?: string; fileSize?: number },
): Promise<
  { success: true; text: string } | { success: false; error: string }
> {
  try {
    logResumeStage.pdfParsing("开始解析 PDF", {
      fileName: metadata?.fileName,
      fileSize: metadata?.fileSize,
    });

    const { text } = await extractText(new Uint8Array(fileBuffer), {
      mergePages: true,
    });

    if (!text || text.trim().length === 0) {
      logResumeStage.error("PDF解析", "PDF 文件为空", null);
      return {
        success: false,
        error: "PDF文件为空或无法提取文本",
      };
    }

    logResumeStage.pdfParsing("PDF 解析成功", {
      textLength: text.length,
      preview: `${text.substring(0, 100)}...`,
    });

    return {
      success: true,
      text: text.trim(),
    };
  } catch (error) {
    logResumeStage.error("PDF解析", "PDF 解析失败", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to parse PDF",
    };
  }
}

async function analyzeResume(
  text: string,
): Promise<
  { success: true; data: ResumeData } | { success: false; error: string }
> {
  try {
    logResumeStage.aiAnalysis("开始 AI 分析简历", {
      textLength: text.length,
    });

    const model = createLangChainChatModelForUseCase({
      useCase: "resume-parse",
      temperature: 0,
    });

    const prompt = `你是一个专业的简历解析助手。请仔细分析简历内容，提取所有关键信息，并以 JSON 格式返回。

注意：
- 如果某个字段在简历中找不到，返回 null 或空数组（日期字段找不到请返回空字符串 ""）
- 工作经历和项目经历要完整提取
- 技能列表要去重
- 日期格式统一为 YYYY-MM 或 YYYY-MM-DD
- 必须返回严格的 JSON 格式，不要包含其他文字

JSON Schema:
{
  "personalInfo": {
    "name": "string | null",
    "email": "string | null",
    "phone": "string | null"
  },
  "jobIntention": "string | null",
  "experienceYears": "number | null",
  "skills": ["string"],
  "education": {
    "school": "string | null",
    "major": "string | null",
    "degree": "string | null",
    "graduationDate": "string | null"
  },
  "workExperiences": [
    {
      "company": "string",
      "position": "string",
      "startDate": "string",
      "endDate": "string",
      "description": "string"
    }
  ],
  "projectExperiences": [
    {
      "projectName": "string",
      "role": "string",
      "startDate": "string | null",
      "endDate": "string | null",
      "techStack": ["string"],
      "description": "string"
    }
  ]
}

请解析以下简历内容：

${text}

请只返回 JSON，不要包含任何其他文字：`;

    const response = await model.invoke([{ role: "user", content: prompt }]);

    let result: ResumeData;
    try {
      const content = response.content as string;
      const jsonMatch = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || [
        null,
        content,
      ];
      const jsonString = jsonMatch[1] || content;
      result = JSON.parse(jsonString.trim());
    } catch (parseError) {
      logResumeStage.error("AI分析", "JSON 解析失败", parseError);
      return {
        success: false,
        error: "AI 返回的数据格式错误，无法解析",
      };
    }

    const validated = resumeSchema.safeParse(result);
    if (!validated.success) {
      logResumeStage.error("AI分析", "数据验证失败", validated.error);
      return {
        success: false,
        error: "AI 返回的数据不符合预期格式",
      };
    }

    logResumeStage.aiAnalysis("AI 分析完成", {
      hasPersonalInfo: !!validated.data.personalInfo,
      hasWorkExperiences: !!validated.data.workExperiences,
      workExperiencesCount: validated.data.workExperiences?.length || 0,
      hasSkills: !!validated.data.skills,
      skillsCount: validated.data.skills?.length || 0,
    });

    if (
      validated.data.workExperiences &&
      validated.data.workExperiences.length > 0
    ) {
      validated.data.workExperiences.forEach((exp, idx) => {
        logResumeStage.aiAnalysis(`工作经历 ${idx + 1}`, {
          company: exp.company,
          position: exp.position,
          startDate: exp.startDate,
          endDate: exp.endDate,
        });
      });
    } else {
      resumeLogger.warn("AI分析", "未解析到工作经历");
    }

    return {
      success: true,
      data: validated.data,
    };
  } catch (error) {
    logResumeStage.error("AI分析", "AI 分析失败", error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Failed to analyze resume",
    };
  }
}

export async function processResumeFromStorage(
  userId: string,
  storagePath: string,
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const supabase = await createClient();
    const { data: fileData, error: downloadError } = await supabase.storage
      .from("resumes")
      .download(storagePath);

    if (downloadError || !fileData) {
      logResumeStage.error("上传", "下载已上传简历失败", downloadError);
      return {
        success: false,
        error: downloadError?.message || "下载简历失败",
      };
    }

    const parseResult = await parsePdfBuffer(await fileData.arrayBuffer(), {
      fileName: storagePath.split("/").pop(),
      fileSize: fileData.size,
    });

    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error,
      };
    }

    const analyzeResult = await analyzeResume(parseResult.text);
    logResumeStage.aiAnalysis("AI 分析结果", {
      success: analyzeResult.success,
      hasData: analyzeResult.success && !!analyzeResult.data,
    });

    if (!analyzeResult.success || !analyzeResult.data) {
      return {
        success: false,
        error: analyzeResult.success ? "AI 分析失败" : analyzeResult.error,
      };
    }

    const resumeUrl = supabase.storage.from("resumes").getPublicUrl(storagePath)
      .data.publicUrl;

    const profileResult = await userProfileService.processResumeAndVectorize({
      userId,
      resumeUrl,
      analyzeData: analyzeResult.data,
    });

    return {
      success: profileResult.success,
      error: profileResult.error,
    };
  } catch (error) {
    logResumeStage.error("上传", "后台简历处理失败", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "后台简历处理失败",
    };
  }
}
