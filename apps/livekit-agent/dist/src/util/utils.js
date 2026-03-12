export const DIRECTOR_BASE_URL = process.env.DIRECTOR_BASE_URL || "http://localhost:3000";
/**
 * 获取历史对话记录
 */
export async function fetchConversationHistory(interviewId) {
    try {
        const url = `${DIRECTOR_BASE_URL}/api/interview/messages?interviewId=${encodeURIComponent(interviewId)}`;
        const response = await fetch(url);
        console.log(response);
        if (!response.ok) {
            console.warn(`[对话历史] 获取失败: ${response.status} ${response.statusText} URL: ${url}`);
            return [];
        }
        const data = await response.json();
        return data.messages || [];
    }
    catch (error) {
        console.error("[对话历史] 获取失败:", error);
        return [];
    }
}
/**
 * 保存消息到数据库
 */
export async function saveMessage(interviewId, role, content) {
    try {
        const response = await fetch(`${DIRECTOR_BASE_URL}/api/interview/messages`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ interviewId, role, content }),
        });
        if (!response.ok) {
            console.error(`[消息保存] 失败: ${response.status} ${await response.text()} URL: ${DIRECTOR_BASE_URL}/api/interview/messages`);
        }
        else {
            console.log(`[消息保存] 成功保存 ${role} 消息`);
        }
    }
    catch (error) {
        console.error("[消息保存] 请求失败:", error);
    }
}
