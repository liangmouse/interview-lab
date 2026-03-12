import { z } from "zod";
import { llm } from "@livekit/agents";
import { createSharedTools } from "../tools";
// --- Tool Definitions ---
/**
 * 工具：记录特定评估标准的得分。
 * 这有助于在最后生成结构化的报告。
 */
export const recordScoreSchema = z.object({
    criteria: z
        .string()
        .describe("正在评估的具体技能或行为特征（例如：'React Hooks', '沟通能力'）。"),
    score: z
        .number()
        .min(0)
        .max(10)
        .describe("0到10分的评分。0=极差, 5=平均, 10=完美。"),
    reasoning: z.string().describe("评分的简要理由。"),
});
/**
 * 工具：查找候选人简历/个人资料中的详细信息。
 * 用于验证声明或查找特定的技术栈。
 */
export const checkResumeSchema = z.object({
    query: z
        .string()
        .describe("要查找的具体技术、职位或公司（例如：'TypeScript', '字节跳动'）。"),
    category: z
        .enum(["skills", "work", "project", "general"])
        .describe("搜索类别。"),
});
/**
 * 工具：控制代码评估流程（开启 / 运行 / 结束）
 */
export const codeAssessmentSchema = z.object({
    action: z
        .enum(["start", "run", "end"])
        .describe("代码评估动作：start=开始，run=执行候选人代码，end=结束。"),
    language: z
        .enum(["javascript", "typescript", "python"])
        .optional()
        .describe("候选人使用的语言。"),
    questionTitle: z.string().optional().describe("题目名称。"),
    code: z.string().optional().describe("候选人提交的代码。"),
    summary: z.string().optional().describe("本轮代码评估总结。"),
});
export function createTools(context) {
    const { userProfile, onToolEvent } = context;
    const sharedTools = createSharedTools({ onToolEvent });
    const recordScore = llm.tool({
        description: "为候选人的技能或特征记录评分 (0-10)。",
        parameters: recordScoreSchema,
        execute: async (args) => {
            const { criteria, score, reasoning } = args;
            console.log(`[评估系统] 📝 记录评分: [${criteria}] ${score}/10 - ${reasoning}`);
            return `评分已记录: ${criteria} = ${score}/10.`;
        },
    });
    const checkResume = llm.tool({
        description: "在候选人简历中搜索特定关键词（技能、公司、项目）。",
        parameters: checkResumeSchema,
        execute: async (args) => {
            const { query, category } = args;
            console.log(`[工具] 🔍 简历检索: ${query} 在 ${category} 中`);
            if (!userProfile)
                return "未找到简历信息。";
            const lowerQuery = query.toLowerCase();
            let result = "";
            if (category === "skills" || category === "general") {
                const skills = Array.isArray(userProfile.skills)
                    ? userProfile.skills
                    : [];
                const matches = skills.filter((s) => s.toLowerCase().includes(lowerQuery));
                if (matches.length > 0)
                    result += `找到技能: ${matches.join(", ")}. `;
            }
            if (category === "work" || category === "general") {
                const works = Array.isArray(userProfile.work_experiences)
                    ? userProfile.work_experiences
                    : [];
                const matches = works.filter((w) => {
                    var _a, _b, _c;
                    return ((_a = w.company) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(lowerQuery)) ||
                        ((_b = w.position) === null || _b === void 0 ? void 0 : _b.toLowerCase().includes(lowerQuery)) ||
                        ((_c = w.description) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes(lowerQuery));
                });
                if (matches.length > 0) {
                    result += `找到工作经历: ${matches.map((w) => `${w.company} (${w.position})`).join("; ")}. `;
                }
            }
            if (category === "project" || category === "general") {
                const projects = Array.isArray(userProfile.project_experiences)
                    ? userProfile.project_experiences
                    : [];
                const matches = projects.filter((p) => {
                    var _a, _b, _c;
                    return ((_a = p.project_name) === null || _a === void 0 ? void 0 : _a.toLowerCase().includes(lowerQuery)) ||
                        ((_b = p.tech_stack) === null || _b === void 0 ? void 0 : _b.some((t) => t.toLowerCase().includes(lowerQuery))) ||
                        ((_c = p.description) === null || _c === void 0 ? void 0 : _c.toLowerCase().includes(lowerQuery));
                });
                if (matches.length > 0) {
                    result += `找到项目经历: ${matches.map((p) => `${p.project_name} (角色: ${p.role})`).join("; ")}. `;
                }
            }
            return result || `简历中未找到关于 '${query}' 的具体提法。`;
        },
    });
    const codeAssessment = llm.tool({
        description: "控制代码评估流程，支持开启、执行与结束。",
        parameters: codeAssessmentSchema,
        execute: async (args) => {
            const { action, language, questionTitle, code, summary } = args;
            if (action === "start") {
                onToolEvent === null || onToolEvent === void 0 ? void 0 : onToolEvent({
                    type: "tool_event",
                    data: {
                        tool: "code_assessment",
                        event: "start",
                        questionTitle: questionTitle || "编程题",
                        language: language || "javascript",
                    },
                });
                return `已开启代码评估：${questionTitle || "编程题"}（${language || "javascript"}）。`;
            }
            if (action === "run") {
                const codeText = (code || "").trim();
                if (!codeText) {
                    return "无法执行：缺少候选人代码。";
                }
                const lineCount = codeText.split("\n").length;
                const hasFunctionLikePattern = /function\s+\w+|=>|def\s+\w+\s*\(/.test(codeText);
                const signal = hasFunctionLikePattern
                    ? "检测到函数定义"
                    : "未检测到函数定义";
                onToolEvent === null || onToolEvent === void 0 ? void 0 : onToolEvent({
                    type: "tool_event",
                    data: {
                        tool: "code_assessment",
                        event: "run",
                        language: language || "javascript",
                        lineCount,
                        signal,
                    },
                });
                return `代码执行完成（${language || "javascript"}），共 ${lineCount} 行，${signal}。`;
            }
            onToolEvent === null || onToolEvent === void 0 ? void 0 : onToolEvent({
                type: "tool_event",
                data: {
                    tool: "code_assessment",
                    event: "end",
                    summary: summary || "代码评估已结束",
                },
            });
            return `已结束代码评估。${summary ? `总结：${summary}` : ""}`;
        },
    });
    return Object.assign(Object.assign({}, sharedTools), { record_score: recordScore, check_resume: checkResume, code_assessment: codeAssessment });
}
