import type { voice } from "@livekit/agents";

export function createUserTextResponder(args: { session: voice.AgentSession }) {
  const { session } = args;
  return async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    await session.generateReply({
      userInput: trimmed,
      allowInterruptions: false,
    });
  };
}
