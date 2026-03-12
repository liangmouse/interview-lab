import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { extractText } from "unpdf";
import type { JobDescriptionAnalysis } from "@/types/job-description";

const jdSchema = z.object({
  title: z.string().nullish(),
  summary: z.string().nullish(),
  experienceLevel: z.string().nullish(),
  keywords: z.array(z.string()).nullish(),
  requirements: z
    .array(
      z.object({
        item: z.string(),
      }),
    )
    .nullish(),
  responsibilities: z
    .array(
      z.object({
        item: z.string(),
      }),
    )
    .nullish(),
});

export async function parseJobDescriptionInput(input: {
  text?: string;
  file?: File | null;
}): Promise<
  | { success: true; text: string; sourceType: "manual" | "upload" }
  | { success: false; error: string }
> {
  const { text, file } = input;

  if (file) {
    const name = file.name.toLowerCase();
    if (name.endsWith(".pdf")) {
      const uint8Array = new Uint8Array(await file.arrayBuffer());
      const parsed = await extractText(uint8Array, { mergePages: true });
      const content = parsed.text?.trim();
      if (!content) return { success: false, error: "上传的 PDF 无法提取文本" };
      return { success: true, text: content, sourceType: "upload" };
    }

    if (name.endsWith(".txt") || name.endsWith(".md")) {
      const content = (await file.text()).trim();
      if (!content) return { success: false, error: "上传文件内容为空" };
      return { success: true, text: content, sourceType: "upload" };
    }

    return {
      success: false,
      error: "岗位描述文件仅支持 .pdf / .txt / .md",
    };
  }

  const raw = text?.trim();
  if (!raw) {
    return { success: false, error: "请提供岗位描述文本或上传文件" };
  }

  return { success: true, text: raw, sourceType: "manual" };
}

export async function analyzeJobDescription(
  rawText: string,
): Promise<
  | { success: true; data: JobDescriptionAnalysis }
  | { success: false; error: string }
> {
  try {
    const model = new ChatOpenAI({
      model: process.env.GEMINI_MODEL || "gemini-3-flash-preview",
      temperature: 0,
      apiKey: process.env.GEMINI_API_KEY,
      configuration: {
        baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
      },
    });

    const prompt = `你是招聘JD分析助手。请从下面的岗位描述中抽取关键信息，并只返回 JSON：

JSON Schema:
{
  "title": "string | null",
  "summary": "string | null",
  "experienceLevel": "string | null",
  "keywords": ["string"],
  "requirements": [{ "item": "string" }],
  "responsibilities": [{ "item": "string" }]
}

要求：
1) keywords 去重，最多 20 个；
2) requirements / responsibilities 每项尽量简洁；
3) 没有信息时返回 null 或空数组；
4) 仅返回 JSON。

JD正文：
${rawText}`;

    const resp = await model.invoke([{ role: "user", content: prompt }]);
    const content = String(resp.content ?? "");
    const matched = content.match(/```(?:json)?\n?([\s\S]*?)\n?```/) || [
      null,
      content,
    ];
    const jsonString = (matched[1] || content).trim();

    const parsed = JSON.parse(jsonString);
    const validated = jdSchema.safeParse(parsed);
    if (!validated.success) {
      return { success: false, error: "JD 分析结果格式不合法" };
    }

    return {
      success: true,
      data: {
        title: validated.data.title ?? null,
        summary: validated.data.summary ?? null,
        experienceLevel: validated.data.experienceLevel ?? null,
        keywords: [...new Set(validated.data.keywords ?? [])].slice(0, 20),
        requirements: validated.data.requirements ?? [],
        responsibilities: validated.data.responsibilities ?? [],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "JD 分析失败",
    };
  }
}
