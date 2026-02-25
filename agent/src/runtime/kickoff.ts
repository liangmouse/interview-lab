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
  const greeting = candidateName
    ? `您好${candidateName},我是今天的面试官,如果你已经准备好,就请做个简单的自我介绍吧`
    : "您好,我是今天的面试官,如果你已经准备好,就请做个简单的自我介绍吧";

  return {
    userInput: "系统：面试开场",
    instructions: `只输出这句固定开场白，不要添加或修改任何内容：${greeting}`,
    allowInterruptions: false,
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
