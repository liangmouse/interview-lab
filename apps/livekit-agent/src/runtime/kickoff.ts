import { voice } from "@livekit/agents";
import { getCandidateName } from "./profile";

interface SendKickoffOptions {
  session: voice.AgentSession;
  userProfile: unknown;
  maxAttempts?: number;
  retryDelayMs?: number;
}

function buildKickoffInstructions(userProfile: unknown) {
  const candidateName = getCandidateName(userProfile);
  // 功能2: 主动开场白 —— 用户加入房间后 Agent 立即邀请自我介绍，包含教育背景、工作经历和技术栈
  const greeting = candidateName
    ? `你好${candidateName}，欢迎参加本次面试！请先做一个简短的自我介绍，包括你的教育背景、工作经历和技术栈。`
    : "你好，欢迎参加本次面试！请先做一个简短的自我介绍，包括你的教育背景、工作经历和技术栈。";

  return {
    userInput: "系统：面试开场",
    instructions: `只输出这句固定开场白，不要添加或修改任何内容：${greeting}`,
    // 开场白期间允许用户随时打断（与 Barge-in 配合）
    allowInterruptions: true,
  };
}

function shouldRetryKickoff(error: unknown) {
  return (
    error instanceof Error && error.message.includes("Agent activity not found")
  );
}

export async function sendKickoffWithRetry({
  session,
  userProfile,
  maxAttempts = 5,
  retryDelayMs = 300,
}: SendKickoffOptions) {
  const payload = buildKickoffInstructions(userProfile);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await session.generateReply(payload);
      return;
    } catch (error) {
      if (!shouldRetryKickoff(error) || attempt >= maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}
