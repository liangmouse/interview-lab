import { interviewDataAccess } from "@interviewclaw/data-access";

export async function saveUserMessage(interviewId: string, content: string) {
  try {
    await interviewDataAccess.saveUserMessage(interviewId, content);
  } catch (e) {
    console.error("[MessagePersistence] Error saving user message:", e);
  }
}

export async function saveAiMessage(interviewId: string, content: string) {
  try {
    await interviewDataAccess.saveAiMessage(interviewId, content);
  } catch (e) {
    console.error("[MessagePersistence] Error saving AI message:", e);
  }
}
