import { interviewDataAccess } from "@interviewclaw/data-access";
export async function saveUserMessage(interviewId, content) {
    try {
        await interviewDataAccess.saveUserMessage(interviewId, content);
    }
    catch (e) {
        console.error("[MessagePersistence] Error saving user message:", e);
    }
}
export async function saveAiMessage(interviewId, content) {
    try {
        await interviewDataAccess.saveAiMessage(interviewId, content);
    }
    catch (e) {
        console.error("[MessagePersistence] Error saving AI message:", e);
    }
}
