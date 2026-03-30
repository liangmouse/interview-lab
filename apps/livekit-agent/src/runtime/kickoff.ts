import { voice } from "@livekit/agents";
import { getCandidateName } from "./profile";

interface SendKickoffOptions {
  session: voice.AgentSession;
  userProfile: unknown;
  maxAttempts?: number;
  retryDelayMs?: number;
}

type HistoryMessage = {
  role?: unknown;
  content?: unknown;
};

type VisibleConversationMessage = {
  role: "user" | "assistant";
  content: string;
};

export function buildKickoffText(userProfile: unknown) {
  const candidateName = getCandidateName(userProfile);
  // 功能2: 主动开场白 —— 用户加入房间后 Agent 立即邀请自我介绍，包含教育背景、工作经历和技术栈
  return candidateName
    ? `你好${candidateName}，欢迎参加本次面试！请先做一个简短的自我介绍，包括你的教育背景、工作经历和技术栈。`
    : "你好，欢迎参加本次面试！请先做一个简短的自我介绍，包括你的教育背景、工作经历和技术栈。";
}

export function getVisibleConversationMessages(
  historyMessages: HistoryMessage[] = [],
): VisibleConversationMessage[] {
  return historyMessages.filter((msg): msg is VisibleConversationMessage => {
    const role = msg?.role;
    const content = msg?.content;
    return (
      (role === "user" || role === "assistant") &&
      typeof content === "string" &&
      content.trim().length > 0
    );
  });
}

export function hasVisibleConversationMessages(
  historyMessages: HistoryMessage[] = [],
) {
  return getVisibleConversationMessages(historyMessages).length > 0;
}

export function createKickoffGate() {
  const states = new Map<string, "in_progress" | "completed">();

  return {
    begin(interviewId: string) {
      if (!interviewId || states.has(interviewId)) {
        return false;
      }

      states.set(interviewId, "in_progress");
      return true;
    },
    complete(interviewId: string) {
      if (!interviewId) return;
      states.set(interviewId, "completed");
    },
    fail(interviewId: string) {
      if (!interviewId) return;
      if (states.get(interviewId) === "in_progress") {
        states.delete(interviewId);
      }
    },
    has(interviewId: string) {
      return states.has(interviewId);
    },
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
  const kickoffText = buildKickoffText(userProfile);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      session.say(kickoffText, {
        allowInterruptions: true,
        addToChatCtx: true,
      });
      return;
    } catch (error) {
      if (!shouldRetryKickoff(error) || attempt >= maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }
}
