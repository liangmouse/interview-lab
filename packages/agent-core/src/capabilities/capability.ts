import type {
  CapabilityRun,
  InterviewDebrief,
  StudyPlan,
} from "@interviewclaw/domain";

export type CapabilityName =
  | "job_hunter"
  | "interview_question_miner"
  | "mock_interviewer"
  | "study_planner"
  | "interview_debrief";

export type CapabilityContext = {
  userId: string;
  locale: string;
};

type PlanArgs = {
  context: CapabilityContext;
  goal: string;
};

type ResumeArgs<TOutput> = {
  context: CapabilityContext;
  previousRun: CapabilityRun<TOutput>;
  signal: string;
};

type SummarizeArgs = {
  context: CapabilityContext;
  input: string;
};

export type Capability<TOutput = unknown> = {
  name: CapabilityName;
  plan(args: PlanArgs): Promise<CapabilityRun<TOutput>>;
  execute(args: PlanArgs): Promise<CapabilityRun<TOutput>>;
  resume(args: ResumeArgs<TOutput>): Promise<CapabilityRun<TOutput>>;
  summarize(args: SummarizeArgs): Promise<CapabilityRun<TOutput>>;
};

function createStudyPlan(
  goal: string,
  userId: string,
): CapabilityRun<StudyPlan> {
  const output: StudyPlan = {
    id: `study-plan:${userId}`,
    userId,
    goal,
    milestones: [
      "梳理目标岗位高频题型",
      "完成系统设计专题复盘",
      "进行一次模拟问答与总结",
    ],
    dailyChecklist: [
      "复盘一个知识盲点",
      "完成两道高频题",
      "记录今日产出与阻塞",
    ],
  };

  return {
    id: `run:study_planner:${userId}`,
    capability: "study_planner",
    summary: `学习计划已生成，围绕“${goal}”安排 3 个里程碑。`,
    output,
  };
}

function createDebrief(
  input: string,
  userId: string,
): CapabilityRun<InterviewDebrief> {
  const output: InterviewDebrief = {
    id: `debrief:${userId}`,
    userId,
    summary: "面试复盘已生成，包含亮点、短板与后续行动。",
    strengths: ["覆盖了缓存与扩容思路", "表达结构整体清晰"],
    gaps: ["一致性策略没有展开", "缺少降级与容灾方案"],
    nextActions: [
      "补一版一致性与降级回答模板",
      "针对系统设计补做 2 道追问题",
      "明天进行一次 20 分钟复盘复述",
    ],
  };

  return {
    id: `run:interview_debrief:${userId}`,
    capability: "interview_debrief",
    summary: `面试复盘已完成：${input.slice(0, 24)}...`,
    output,
  };
}

function createPlaceholderCapability(name: CapabilityName): Capability {
  return {
    name,
    async plan({ context, goal }) {
      return {
        id: `run:${name}:${context.userId}`,
        capability: name,
        summary: `${name} 已规划目标：${goal}`,
        output: { goal },
      };
    },
    async execute({ context, goal }) {
      return {
        id: `run:${name}:${context.userId}:execute`,
        capability: name,
        summary: `${name} 已执行目标：${goal}`,
        output: { goal },
      };
    },
    async resume({ context, previousRun, signal }) {
      return {
        id: `run:${name}:${context.userId}:resume`,
        capability: name,
        summary: `${name} 已基于已有结果继续推进：${signal}`,
        output: previousRun.output,
      };
    },
    async summarize({ context, input }) {
      return {
        id: `run:${name}:${context.userId}:summary`,
        capability: name,
        summary: `${name} 总结：${input}`,
        output: { input },
      };
    },
  };
}

export function createCapabilityRegistry() {
  const studyPlanner: Capability<StudyPlan> = {
    name: "study_planner",
    async plan({ context, goal }) {
      const run = createStudyPlan(goal, context.userId);
      return {
        ...run,
        summary: `学习计划已生成：${run.summary}`,
      };
    },
    async execute({ context, goal }) {
      return createStudyPlan(goal, context.userId);
    },
    async resume({ context, previousRun, signal }) {
      return {
        id: `run:study_planner:${context.userId}:resume`,
        capability: "study_planner",
        summary: `继续推进学习计划：${signal}`,
        output: previousRun.output,
      };
    },
    async summarize({ context, input }) {
      return {
        id: `run:study_planner:${context.userId}:summary`,
        capability: "study_planner",
        summary: `学习计划总结：${input}`,
        output: createStudyPlan(input, context.userId).output,
      };
    },
  };

  const interviewDebrief: Capability<InterviewDebrief> = {
    name: "interview_debrief",
    async plan({ context, goal }) {
      return createDebrief(goal, context.userId);
    },
    async execute({ context, goal }) {
      return createDebrief(goal, context.userId);
    },
    async resume({ context, previousRun, signal }) {
      return {
        id: `run:interview_debrief:${context.userId}:resume`,
        capability: "interview_debrief",
        summary: `继续推进面试复盘：${signal}`,
        output: previousRun.output,
      };
    },
    async summarize({ context, input }) {
      const run = createDebrief(input, context.userId);
      return {
        ...run,
        summary: "面试复盘已生成，包含三条后续行动。",
      };
    },
  };

  const registry = new Map<CapabilityName, Capability>([
    ["job_hunter", createPlaceholderCapability("job_hunter")],
    [
      "interview_question_miner",
      createPlaceholderCapability("interview_question_miner"),
    ],
    ["mock_interviewer", createPlaceholderCapability("mock_interviewer")],
    ["study_planner", studyPlanner],
    ["interview_debrief", interviewDebrief],
  ]);

  return {
    get(name: CapabilityName) {
      const capability = registry.get(name);
      if (!capability) {
        throw new Error(`Unknown capability: ${name}`);
      }
      return capability;
    },
    list() {
      return Array.from(registry.values());
    },
  };
}
