import { z } from "zod";
import { llm } from "@livekit/agents";
import { createSharedTools } from "../tools";
import { InterviewOrchestrator } from "./interview-orchestrator";

// --- Tool Definitions ---

/**
 * 工具：记录特定评估标准的得分。
 * 这有助于在最后生成结构化的报告。
 */
export const recordScoreSchema = z.object({
  criteria: z
    .string()
    .describe(
      "正在评估的具体技能或行为特征（例如：'React Hooks', '沟通能力'）。",
    ),
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
    .describe(
      "要查找的具体技术、职位或公司（例如：'TypeScript', '字节跳动'）。",
    ),
  category: z
    .enum(["skills", "work", "project", "general"])
    .describe("搜索类别。"),
});

/**
 * 工具：控制代码评估流程（开启 / 运行 / 结束）
 *
 * action=start 时必须填写题目相关字段（questionTitle / description /
 * difficulty / language / solutionTemplate / testTemplate），前端依赖
 * 这些字段渲染题目内容和初始化代码编辑器。
 */
export const codeAssessmentSchema = z.object({
  action: z
    .enum(["start", "run", "end"])
    .describe(
      "代码评估动作：start=开始并展示题目，run=执行候选人代码，end=结束。",
    ),
  // ── start 专用字段（action=start 时必填） ──────────────────────────────
  questionTitle: z
    .string()
    .optional()
    .describe("[action=start 必填] 题目名称，例如「反转链表」。"),
  description: z
    .string()
    .optional()
    .describe("[action=start 必填] 题目描述，说明输入输出格式与约束条件。"),
  difficulty: z
    .enum(["easy", "medium", "hard"])
    .optional()
    .describe("[action=start 必填] 题目难度：easy / medium / hard。"),
  language: z
    .enum(["javascript", "typescript", "python"])
    .optional()
    .describe("[action=start 必填] 题目使用的编程语言。"),
  solutionTemplate: z
    .string()
    .optional()
    .describe("[action=start 必填] 解题代码起始模板（含函数签名和必要注释）。"),
  testTemplate: z
    .string()
    .optional()
    .describe(
      "[action=start 必填] 测试代码模板（含若干断言用例，与 solutionTemplate 同语言）。",
    ),
  // ── run 专用字段 ──────────────────────────────────────────────────────
  code: z.string().optional().describe("[action=run] 候选人提交的代码。"),
  // ── end 专用字段 ──────────────────────────────────────────────────────
  summary: z.string().optional().describe("[action=end] 本轮代码评估总结。"),
});

// --- Tool Handlers ---

type ToolEventPayload = Record<string, unknown>;

type ToolsContext = {
  userProfile: any;
  onToolEvent?: (payload: ToolEventPayload) => void;
  interviewOrchestrator?: InterviewOrchestrator;
};

const interviewTurnPlannerSchema = z.object({
  action: z
    .enum(["start", "continue"])
    .describe("start=获取当前主问题，continue=根据候选人回答决定下一问。"),
  answer: z
    .string()
    .optional()
    .describe("候选人上一轮回答内容。action=continue 时必填。"),
});

export function createTools(context: ToolsContext) {
  const { userProfile, onToolEvent, interviewOrchestrator } = context;
  const sharedTools = createSharedTools({ onToolEvent });

  const recordScore = llm.tool({
    description: "为候选人的技能或特征记录评分 (0-10)。",
    parameters: recordScoreSchema,
    execute: async (args) => {
      const { criteria, score, reasoning } = args;
      console.log(
        `[评估系统] 📝 记录评分: [${criteria}] ${score}/10 - ${reasoning}`,
      );
      return `评分已记录: ${criteria} = ${score}/10.`;
    },
  });

  const checkResume = llm.tool({
    description: "在候选人简历中搜索特定关键词（技能、公司、项目）。",
    parameters: checkResumeSchema,
    execute: async (args) => {
      const { query, category } = args;
      console.log(`[工具] 🔍 简历检索: ${query} 在 ${category} 中`);

      if (!userProfile) return "未找到简历信息。";

      const lowerQuery = query.toLowerCase();
      let result = "";

      if (category === "skills" || category === "general") {
        const skills = Array.isArray(userProfile.skills)
          ? userProfile.skills
          : [];
        const matches = skills.filter((s: string) =>
          s.toLowerCase().includes(lowerQuery),
        );
        if (matches.length > 0) result += `找到技能: ${matches.join(", ")}. `;
      }

      if (category === "work" || category === "general") {
        const works = Array.isArray(userProfile.work_experiences)
          ? userProfile.work_experiences
          : [];
        const matches = works.filter(
          (w: any) =>
            w.company?.toLowerCase().includes(lowerQuery) ||
            w.position?.toLowerCase().includes(lowerQuery) ||
            w.description?.toLowerCase().includes(lowerQuery),
        );
        if (matches.length > 0) {
          result += `找到工作经历: ${matches.map((w: any) => `${w.company} (${w.position})`).join("; ")}. `;
        }
      }

      if (category === "project" || category === "general") {
        const projects = Array.isArray(userProfile.project_experiences)
          ? userProfile.project_experiences
          : [];
        const matches = projects.filter(
          (p: any) =>
            p.project_name?.toLowerCase().includes(lowerQuery) ||
            p.tech_stack?.some((t: string) =>
              t.toLowerCase().includes(lowerQuery),
            ) ||
            p.description?.toLowerCase().includes(lowerQuery),
        );
        if (matches.length > 0) {
          result += `找到项目经历: ${matches.map((p: any) => `${p.project_name} (角色: ${p.role})`).join("; ")}. `;
        }
      }

      return result || `简历中未找到关于 '${query}' 的具体提法。`;
    },
  });

  const codeAssessment = llm.tool({
    description: "控制代码评估流程，支持开启、执行与结束。",
    parameters: codeAssessmentSchema,
    execute: async (args) => {
      if (args.action === "start") {
        const {
          language,
          questionTitle,
          description,
          difficulty,
          solutionTemplate,
          testTemplate,
        } = args;
        onToolEvent?.({
          type: "tool_event",
          data: {
            tool: "code_assessment",
            event: "start",
            questionTitle,
            language,
            description,
            difficulty,
            solutionTemplate,
            testTemplate,
          },
        });
        return `已开启代码评估：${questionTitle}（${language}）。`;
      }

      if (args.action === "run") {
        const { language, code } = args;
        const codeText = (code || "").trim();
        if (!codeText) {
          return "无法执行：缺少候选人代码。";
        }

        const lineCount = codeText.split("\n").length;
        const hasFunctionLikePattern = /function\s+\w+|=>|def\s+\w+\s*\(/.test(
          codeText,
        );
        const signal = hasFunctionLikePattern
          ? "检测到函数定义"
          : "未检测到函数定义";

        onToolEvent?.({
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

      // action === "end"
      const { summary } = args;
      onToolEvent?.({
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

  const interviewTurnPlanner = llm.tool({
    description:
      "根据面试计划和候选人上一轮回答，返回当前应该问的下一题或追问。你必须优先使用返回的 question_text，不要自行改写问题目标。",
    parameters: interviewTurnPlannerSchema,
    execute: async (args) => {
      if (!interviewOrchestrator) {
        return "面试计划工具当前不可用。";
      }

      const result =
        args.action === "start"
          ? await interviewOrchestrator.start()
          : await interviewOrchestrator.continue(args.answer || "");

      return [
        `question_id: ${result.question.questionId}`,
        `decision_action: ${result.decision.action}`,
        `decision_reason: ${result.decision.reason}`,
        `question_text: ${result.decision.questionText}`,
        result.analysis
          ? `mastery_estimate: ${result.analysis.masteryEstimate}`
          : "mastery_estimate: unknown",
      ].join("\n");
    },
  });

  return {
    ...sharedTools,
    interview_turn_planner: interviewTurnPlanner,
    record_score: recordScore,
    check_resume: checkResume,
    code_assessment: codeAssessment,
  };
}
