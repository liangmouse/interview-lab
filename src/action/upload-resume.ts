"use server";

import { createClient } from "@/lib/supabase/server";
import { v4 as uuidv4 } from "uuid";
import { extractText } from "unpdf";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { userProfileService } from "@/lib/user-profile-service";
import { logResumeStage, resumeLogger } from "@/lib/resume-parsing-logger";

// ============ 类型定义 ============

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
        startDate: z.string().nullish(), // 允许为空
        endDate: z.string().nullish(), // 允许为空
        description: z.string(),
      }),
    )
    .nullish(),
  projectExperiences: z
    .array(
      z.object({
        projectName: z.string(),
        role: z.string().nullish(),
        startDate: z.string().nullish(), // 允许为空
        endDate: z.string().nullish(), // 允许为空
        techStack: z.array(z.string()).nullish(),
        description: z.string(),
      }),
    )
    .nullish(),
});

export type ResumeData = z.infer<typeof resumeSchema>;

interface ProfileUpdateData {
  nickname?: string | null;
  email?: string | null;
  job_intention?: string | null;
  experience_years?: number | null;
  skills?: string[] | null;
  school?: string | null;
  major?: string | null;
  degree?: string | null;
  graduation_date?: string | null;
  work_experiences?: Array<{
    company: string;
    position: string;
    start_date: string;
    end_date: string;
    description: string;
  }> | null;
  project_experiences?: Array<{
    project_name: string;
    role: string;
    start_date?: string | null;
    end_date?: string | null;
    tech_stack?: string[] | null;
    description: string;
  }> | null;
  resume_url?: string;
  updated_at?: string;
}

/**
 * 解析PDF文件（使用unpdf）
 */
async function parsePdf(
  file: File,
): Promise<
  { success: true; text: string } | { success: false; error: string }
> {
  try {
    logResumeStage.pdfParsing("开始解析 PDF", {
      fileName: file.name,
      fileSize: file.size,
    });

    const arrayBuffer = await file.arrayBuffer();
    // unpdf 需要 Uint8Array 而不是 Buffer
    const uint8Array = new Uint8Array(arrayBuffer);

    // unpdf 自动处理各种PDF格式
    const { text } = await extractText(uint8Array, {
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
      preview: text.substring(0, 100) + "...",
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

/**
 * 使用AI分析简历（使用withStructuredOutput简化）
 */
async function analyzeResume(
  text: string,
): Promise<
  { success: true; data: ResumeData } | { success: false; error: string }
> {
  try {
    logResumeStage.aiAnalysis("开始 AI 分析简历", {
      textLength: text.length,
    });

    // 使用普通的 ChatOpenAI，不使用 withStructuredOutput
    const model = new ChatOpenAI({
      model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
      temperature: 0,
      apiKey: process.env.GEMINI_API_KEY,
      configuration: {
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      },
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

    const response = await model.invoke([
      {
        role: "user",
        content: prompt,
      },
    ]);

    // 解析 AI 返回的 JSON
    let result: ResumeData;
    try {
      const content = response.content as string;
      // 尝试提取 JSON（可能包含 markdown 代码块）
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

    // 验证结果
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

    // 详细记录工作经历
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

/**
 * 上传简历主函数
 */
export async function uploadResume(formData: FormData) {
  try {
    // 1. 验证用户
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { success: false, error: "User not authenticated" };
    }

    const file = formData.get("file") as File;
    if (!file) {
      return { success: false, error: "No file provided" };
    }

    // 2. 解析PDF
    const parseResult = await parsePdf(file);
    if (!parseResult.success) {
      return {
        success: false,
        error: parseResult.error,
      };
    }

    // 3. AI分析简历
    const analyzeResult = await analyzeResume(parseResult.text);

    logResumeStage.aiAnalysis("AI 分析结果", {
      success: analyzeResult.success,
      hasData: analyzeResult.success && !!analyzeResult.data,
    });

    if (!analyzeResult.success) {
      return { success: false, error: analyzeResult.error };
    }

    // 4. 上传文件到Storage
    const fileName = `${user.id}/${uuidv4()}.pdf`;
    // Supabase Storage 也支持 Uint8Array，无需再次转换
    const { error: uploadError } = await supabase.storage
      .from("resumes")
      .upload(fileName, file, { contentType: "application/pdf" });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return { success: false, error: `Storage error: ${uploadError.message}` };
    }

    // 5. 获取公开URL
    const { data: publicUrlData } = supabase.storage
      .from("resumes")
      .getPublicUrl(fileName);

    if (!publicUrlData) {
      console.error("Error getting public URL");
      return { success: false, error: "Could not get public URL for resume" };
    }

    const publicUrl = publicUrlData.publicUrl;

    // 5. 类型安全的数据映射
    if (!analyzeResult.success || !analyzeResult.data) {
      return { success: false, error: "AI 分析数据为空" };
    }

    logResumeStage.dataMapping("开始数据映射", {
      hasWorkExperiences: !!analyzeResult.data.workExperiences,
      workExperiencesCount: analyzeResult.data.workExperiences?.length || 0,
    });
    const analyzeData = analyzeResult.data;
    const profileUpdateData: ProfileUpdateData = {
      nickname: analyzeData.personalInfo?.name,
      email: analyzeData.personalInfo?.email,
      job_intention: analyzeData.jobIntention,
      experience_years: analyzeData.experienceYears,
      skills: analyzeData.skills,
      school: analyzeData.education?.school,
      major: analyzeData.education?.major,
      degree: analyzeData.education?.degree,
      graduation_date: analyzeData.education?.graduationDate,
      work_experiences: analyzeData.workExperiences?.map((exp) => ({
        company: exp.company,
        position: exp.position,
        start_date: exp.startDate || "", // 提供默认值
        end_date: exp.endDate || "", // 提供默认值
        description: exp.description,
      })),
      project_experiences: analyzeData.projectExperiences?.map((proj) => ({
        project_name: proj.projectName,
        role: proj.role || "", // 提供默认值
        start_date: proj.startDate,
        end_date: proj.endDate,
        tech_stack: proj.techStack,
        description: proj.description,
      })),
      resume_url: publicUrl,
      updated_at: new Date().toISOString(),
    };

    // 详细记录映射后的工作经历
    if (profileUpdateData.work_experiences) {
      logResumeStage.dataMapping("工作经历映射完成", {
        count: profileUpdateData.work_experiences.length,
        data: profileUpdateData.work_experiences,
      });
    } else {
      resumeLogger.warn("数据映射", "工作经历映射结果为空");
    }

    // 过滤掉undefined和null值
    const filteredData = Object.fromEntries(
      Object.entries(profileUpdateData).filter(
        ([, value]) => value !== undefined && value !== null,
      ),
    ) as ProfileUpdateData;

    logResumeStage.dataMapping("过滤后的数据", {
      hasWorkExperiences: !!filteredData.work_experiences,
      workExperiencesCount: filteredData.work_experiences?.length || 0,
      fields: Object.keys(filteredData),
    });

    // 只保留数据库中确定存在的核心字段（白名单策略）
    // 这样可以避免因数据库 schema 不匹配导致的更新失败
    const dbSafeData: any = {
      // 核心字段：只保留最重要的数据
      nickname: filteredData.nickname,
      email: filteredData.email,
      job_intention: filteredData.job_intention,
      experience_years: filteredData.experience_years,
      skills: filteredData.skills,
      school: filteredData.school,
      major: filteredData.major,
      degree: filteredData.degree,
      graduation_date: filteredData.graduation_date,
      work_experiences: filteredData.work_experiences,
      project_experiences: filteredData.project_experiences,
      resume_url: filteredData.resume_url,
      updated_at: filteredData.updated_at,
    };

    // 过滤掉 undefined 和 null
    Object.keys(dbSafeData).forEach((key) => {
      if (dbSafeData[key] === undefined || dbSafeData[key] === null) {
        delete dbSafeData[key];
      }
    });

    logResumeStage.dbUpdate("开始更新数据库", {
      userId: user.id,
      fieldsToUpdate: Object.keys(dbSafeData),
      note: "使用白名单策略，只更新核心字段",
    });

    const { data, error } = await supabase
      .from("user_profiles")
      .update(dbSafeData)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      logResumeStage.error("数据库更新", "更新失败", error);
      return {
        success: false,
        error: `Profile update error: ${error.message}`,
      };
    }

    logResumeStage.dbUpdate("数据库更新成功", {
      hasWorkExperiences: !!data.work_experiences,
      workExperiencesCount: data.work_experiences?.length || 0,
    });

    // 6. 向量化用户档案
    try {
      const vectorizeResult = await userProfileService.vectorizeUserProfile(
        user.id,
      );
      if (!vectorizeResult.success) {
        console.warn("向量化用户档案失败:", vectorizeResult.error);
        // 不返回错误，因为简历上传已经成功
      } else {
        console.log(
          "用户档案向量化成功，文档数量:",
          vectorizeResult.documentCount,
        );
      }
    } catch (vectorizeError) {
      console.warn("向量化用户档案时发生错误:", vectorizeError);
      // 不返回错误，因为简历上传已经成功
    }

    return { success: true, data };
  } catch (e) {
    const error = e as Error;
    console.error("Upload resume error:", error);
    return { success: false, error: error.message };
  }
}
