import { supabaseAdmin } from "../../../web/src/lib/supabase/admin";
export async function saveUserMessage(interviewId, content) {
    try {
        const { error } = await supabaseAdmin.rpc("add_user_message", {
            p_interview_id: interviewId,
            p_content: content.trim(),
        });
        if (error) {
            console.error("[MessagePersistence] Failed to save user message:", error);
        }
        else {
            console.log("[MessagePersistence] Saved user message:", content.substring(0, 20) + "...");
        }
    }
    catch (e) {
        console.error("[MessagePersistence] Error saving user message:", e);
    }
}
export async function saveAiMessage(interviewId, content) {
    try {
        const { error } = await supabaseAdmin.rpc("add_ai_message", {
            p_interview_id: interviewId,
            p_content: content.trim(),
        });
        if (error) {
            console.error("[MessagePersistence] Failed to save AI message:", error);
        }
        else {
            console.log("[MessagePersistence] Saved AI message:", content.substring(0, 20) + "...");
        }
    }
    catch (e) {
        console.error("[MessagePersistence] Error saving AI message:", e);
    }
}
