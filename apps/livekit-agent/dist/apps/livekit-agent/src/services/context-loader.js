import { interviewDataAccess } from "@interviewclaw/data-access";
export async function loadUserContext(userId) {
    try {
        return await interviewDataAccess.loadUserProfile(userId);
    }
    catch (e) {
        console.error(`[ContextLoader] Unexpected error:`, e);
        return null;
    }
}
export async function loadInterviewContext(interviewId) {
    try {
        return await interviewDataAccess.loadInterview(interviewId);
    }
    catch (e) {
        console.error(`[ContextLoader] Unexpected error:`, e);
        return null;
    }
}
/**
 * 构造用于 LLM 的 system prompt（在基础提示词上拼接候选人与面试上下文）。
 *
 * @param profile 候选人档案（来自 `user_profiles`），可为 `null/undefined`。
 * @param basePrompt 基础 system prompt 文本。
 * @param interview 面试记录（来自 `interviews`），可选。
 * @returns 拼接了 interview/candidate/runtime 指令片段后的完整 system prompt 字符串。
 */
export function buildSystemPrompt(profile, basePrompt, interview) {
    var _a;
    if (!profile && !interview)
        return basePrompt;
    let interviewPart = "";
    if (interview) {
        // 解析 type 字段 (topic:difficulty)
        const [topic, difficulty] = (interview.type || "").split(":");
        const duration = (_a = interview.duration) !== null && _a !== void 0 ? _a : "未知";
        const resolvedTopic = topic || interview.type || "综合技术";
        const resolvedDifficulty = difficulty || "默认";
        const resolvedStatus = interview.status || "进行中";
        interviewPart = `
<interview_context readonly="true">
topic: ${resolvedTopic}
difficulty: ${resolvedDifficulty}
duration_minutes: ${duration}
status: ${resolvedStatus}
</interview_context>
`;
    }
    const skills = Array.isArray(profile === null || profile === void 0 ? void 0 : profile.skills)
        ? profile.skills.join(", ")
        : profile === null || profile === void 0 ? void 0 : profile.skills;
    const workExperiences = Array.isArray(profile === null || profile === void 0 ? void 0 : profile.work_experiences) && profile.work_experiences.length
        ? profile.work_experiences
            .map((exp, idx) => {
            const company = (exp === null || exp === void 0 ? void 0 : exp.company) || "未知公司";
            const position = (exp === null || exp === void 0 ? void 0 : exp.position) || "未知岗位";
            const start = (exp === null || exp === void 0 ? void 0 : exp.start_date) || "?";
            const end = (exp === null || exp === void 0 ? void 0 : exp.end_date) || "?";
            const desc = (exp === null || exp === void 0 ? void 0 : exp.description) || "";
            return `work_${idx + 1}: company=${company}; position=${position}; period=${start}-${end}; description=${desc}`;
        })
            .join("\n")
        : "work_0: none";
    const projectExperiences = Array.isArray(profile === null || profile === void 0 ? void 0 : profile.project_experiences) &&
        profile.project_experiences.length
        ? profile.project_experiences
            .map((proj, idx) => {
            const name = (proj === null || proj === void 0 ? void 0 : proj.project_name) || "未命名项目";
            const role = (proj === null || proj === void 0 ? void 0 : proj.role) || "成员";
            const tech = Array.isArray(proj === null || proj === void 0 ? void 0 : proj.tech_stack) && proj.tech_stack.length
                ? proj.tech_stack.join(", ")
                : (proj === null || proj === void 0 ? void 0 : proj.tech_stack) || "未指定";
            const desc = (proj === null || proj === void 0 ? void 0 : proj.description) || "";
            return `project_${idx + 1}: name=${name}; role=${role}; tech_stack=${tech}; description=${desc}`;
        })
            .join("\n")
        : "project_0: none";
    const contextPart = profile
        ? `
<candidate_context readonly="true">
name: ${profile.nickname || "未知"}
job_intention: ${profile.job_intention || "未指定"}
experience_years: ${profile.experience_years || 0}
skills: ${skills || "无"}
${workExperiences}
${projectExperiences}
</candidate_context>
`
        : "";
    const resolvedTopic = interview ? (interview.type || "").split(":")[0] : "";
    const resolvedDifficulty = interview
        ? (interview.type || "").split(":")[1]
        : "";
    const instructionPart = `
<runtime_directives readonly="true">
Use interview_context and candidate_context to tailor questions.
If information is missing or conflicting, ask for clarification before concluding.
Keep time budget: ${(interview === null || interview === void 0 ? void 0 : interview.duration) || 30} minutes.
Preferred topic: ${resolvedTopic || "通用"}; difficulty: ${resolvedDifficulty || "默认"}.
</runtime_directives>
`;
    return `${basePrompt}\n${interviewPart}\n${contextPart}\n${instructionPart}`;
}
export async function loadInterviewMessages(interviewId) {
    try {
        return await interviewDataAccess.loadInterviewMessages(interviewId);
    }
    catch (e) {
        console.error(`[ContextLoader] Unexpected error loading messages:`, e);
        return [];
    }
}
