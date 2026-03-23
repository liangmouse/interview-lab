import { llm } from "@livekit/agents";
import { createConfiguredLLM } from "../../config/providers";
import { InterviewStage } from "./types";

export async function summarizeStage(
  stage: InterviewStage,
  messages: llm.ChatMessage[],
  userId: string,
): Promise<string> {
  if (messages.length === 0) return "";

  const transcript = messages.map((m) => `${m.role}: ${m.content}`).join("\n");

  const prompt = `
You are an expert interview recorder.
Please summarize the following interaction from the "${stage}" stage of a technical interview.
Focus on:
1. Topics covered.
2. Candidate's key answers and demonstrated skills.
3. Any red flags or strong signals.

Keep the summary concise (under 200 words).
Transcript:
${transcript}
  `;

  try {
    const summarizerLLM = await createConfiguredLLM(
      userId,
      {
        traceName: "interview-stage-summarizer",
        tags: ["livekit-agent", "stage-summarizer", stage],
        metadata: {
          stage,
          messageCount: messages.length,
        },
      },
      {
        useCase: "interview-summary",
      },
    );
    // OpenAI LLM 实现特定
    // 我们为总结任务创建一个临时的聊天上下文
    const chatCtx = new llm.ChatContext();
    chatCtx.addMessage({
      role: "system",
      content: prompt,
    });

    const stream = await summarizerLLM.chat({
      chatCtx: chatCtx,
    });

    let summary = "";
    for await (const chunk of stream) {
      const c = chunk as any;
      const delta = c.choices?.[0]?.delta?.content || c.content || "";
      summary += delta;
    }

    console.log(
      `[总结模块] 生成阶段 ${stage} 的总结:`,
      summary.substring(0, 50) + "...",
    );
    return summary.trim();
  } catch (error) {
    console.error(`[总结模块] 阶段 ${stage} 总结失败:`, error);
    return "总结生成失败。";
  }
}
