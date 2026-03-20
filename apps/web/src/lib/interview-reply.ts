import {
  createLangChainChatModel,
  validateLlmConfig,
} from "@interviewclaw/ai-runtime";
import {
  BASE_INTERVIEWER_PROMPT,
  CONVERSATION_HISTORY_GUIDANCE,
  INTERVIEW_PACE_GUIDANCE,
  SINGLE_QUESTION_CONSTRAINT,
  SINGLE_QUESTION_GUIDANCE,
} from "@/lib/prompt/interview";

type InterviewTurnMessage = {
  role: "user" | "assistant";
  content: string;
};

const INTERVIEW_SYSTEM_PROMPT = [
  BASE_INTERVIEWER_PROMPT,
  CONVERSATION_HISTORY_GUIDANCE,
  SINGLE_QUESTION_GUIDANCE,
  INTERVIEW_PACE_GUIDANCE,
  SINGLE_QUESTION_CONSTRAINT,
  "请基于已有对话继续面试，保持专业、自然、简洁。",
  "如果候选人的回答信息不足，优先做一次单点追问。",
  "不要输出分点列表，不要一次提多个问题。",
].join("\n\n");

function extractTextContent(content: unknown): string {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object" && "text" in item) {
          return String(item.text ?? "");
        }
        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

export async function generateInterviewReply(
  conversation: InterviewTurnMessage[],
): Promise<string> {
  const configValidation = validateLlmConfig();
  if (!configValidation.isValid) {
    throw new Error(configValidation.error || "LLM provider 配置无效");
  }

  const model = createLangChainChatModel({ temperature: 0.7 });

  const response = await model.invoke([
    {
      role: "system",
      content: INTERVIEW_SYSTEM_PROMPT,
    },
    ...conversation,
  ]);

  const reply = extractTextContent(response.content);
  if (!reply) {
    throw new Error("AI 未返回有效面试回复");
  }

  return reply;
}
