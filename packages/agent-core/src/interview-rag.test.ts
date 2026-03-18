import { describe, expect, it } from "vitest";
import {
  analyzeAnswer,
  createInterviewPlan,
  decideFollowUp,
} from "./interview-rag";
import type { QuestionAsset } from "@interviewclaw/domain";

const questionAssets: QuestionAsset[] = [
  {
    id: "q-frontend",
    questionText: "请解释 React 中 useEffect 的执行时机和常见陷阱。",
    questionType: "knowledge",
    roleFamily: "frontend",
    seniority: "mid",
    topics: ["react", "hooks"],
    difficulty: 4,
    expectedSignals: ["执行时机", "依赖数组", "清理函数", "原理"],
    goodAnswerRubric: [],
    badAnswerPatterns: [],
    followUpTemplates: {
      ask_principle: ["继续说一下依赖数组为什么会影响副作用触发。"],
    },
    sourceType: "manual",
    qualityScore: 0.92,
    language: "zh",
  },
  {
    id: "q-backend",
    questionText: "MySQL 索引失效有哪些常见场景？",
    questionType: "knowledge",
    roleFamily: "backend",
    seniority: "mid",
    topics: ["mysql", "index"],
    difficulty: 4,
    expectedSignals: ["最左前缀", "函数操作", "类型转换"],
    goodAnswerRubric: [],
    badAnswerPatterns: [],
    followUpTemplates: {},
    sourceType: "manual",
    qualityScore: 0.9,
    language: "zh",
  },
];

describe("interview-rag core", () => {
  it("prefers role-matched questions in generated plan", () => {
    const plan = createInterviewPlan({
      interviewId: "i-1",
      profile: {
        job_intention: "前端工程师",
        experience_years: 3,
        skills: ["React", "TypeScript"],
      },
      questionAssets,
      limit: 2,
    });

    expect(plan.candidateProfile.roleFamily).toBe("frontend");
    expect(plan.questions[0]?.questionId).toBe("q-frontend");
  });

  it("asks principle follow-up when answer lacks depth", () => {
    const plan = createInterviewPlan({
      interviewId: "i-2",
      profile: {
        job_intention: "前端工程师",
        experience_years: 3,
        skills: ["React"],
      },
      questionAssets,
      limit: 1,
    });
    const question = plan.questions[0];
    const analysis = analyzeAnswer({
      answer:
        "useEffect 一般会在组件渲染后执行，我平时会用它发请求和做事件监听，也会注意卸载时清理副作用，但为什么依赖数组会影响触发结果，我其实没有深入研究过。",
      question,
    });
    const decision = decideFollowUp({
      plan,
      currentQuestion: question,
      currentIndex: 0,
      analysis,
    });

    expect(analysis.riskFlags).toContain("principle_gap");
    expect(decision.action).toBe("ask_principle");
  });
});
