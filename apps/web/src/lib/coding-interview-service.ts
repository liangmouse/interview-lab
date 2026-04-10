import { z } from "zod";
import {
  createLangChainChatModelForUseCase,
  validateLlmConfig,
} from "@interviewclaw/ai-runtime";
import { buildCandidateProfile } from "@interviewclaw/agent-core";
import { loadQuestionAssets } from "@interviewclaw/data-access";
import type { CodeProblem } from "@/components/interview/code-editor-utils";
import {
  CODING_INTERVIEW_QUESTION_COUNT,
  CODING_INTERVIEW_RESUME_TO_LEETCODE_RATIO,
  parseInterviewType,
} from "@/lib/interview-session";

export const CODING_INTERVIEW_GENERATION_TIMEOUT_MS = 8000;

const codingProblemSchema = z.object({
  title: z.string().min(1),
  sourceKind: z.enum(["resume", "leetcode"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  description: z.string().min(1),
  examples: z
    .array(
      z.object({
        input: z.string().min(1),
        output: z.string().min(1),
        explanation: z.string().optional(),
      }),
    )
    .min(1)
    .max(3),
  constraints: z.array(z.string().min(1)).min(1).max(6),
  solutionTemplate: z.string().min(1),
  testTemplate: z.string().min(1),
});

const codingInterviewSetSchema = z.object({
  summary: z.string().min(1),
  problems: z
    .array(codingProblemSchema)
    .length(CODING_INTERVIEW_QUESTION_COUNT),
});

type CodingInterviewSet = z.infer<typeof codingInterviewSetSchema>;
export type CodingProblemSource = z.infer<
  typeof codingProblemSchema
>["sourceKind"];

type GenerateCodingInterviewArgs = {
  interviewId: string;
  interview: {
    type?: string | null;
  };
  profile: {
    nickname?: string | null;
    job_intention?: string | null;
    experience_years?: number | null;
    company_intention?: string | null;
    skills?: string[] | null;
    work_experiences?: Array<{
      company?: string | null;
      position?: string | null;
      description?: string | null;
    }> | null;
    project_experiences?: Array<{
      project_name?: string | null;
      role?: string | null;
      tech_stack?: string[] | null;
      description?: string | null;
    }> | null;
  };
};

type CodingInterviewGenerationSource = "llm" | "fallback" | "timeout-fallback";

type CodingInterviewGenerationResult = {
  problems: CodeProblem[];
  source: CodingInterviewGenerationSource;
};

const DIFFICULTY_PLANS = {
  beginner: ["easy", "easy", "medium"],
  intermediate: ["easy", "medium", "medium"],
  advanced: ["medium", "medium", "hard"],
  expert: ["medium", "hard", "hard"],
} as const;

const CODING_SOURCE_TOTAL_WEIGHT =
  CODING_INTERVIEW_RESUME_TO_LEETCODE_RATIO.resume +
  CODING_INTERVIEW_RESUME_TO_LEETCODE_RATIO.leetcode;
const RESUME_SOURCE_PROBABILITY =
  CODING_INTERVIEW_RESUME_TO_LEETCODE_RATIO.resume / CODING_SOURCE_TOTAL_WEIGHT;
const resolvedProblemCache = new Map<string, CodingInterviewGenerationResult>();
const inflightProblemCache = new Map<
  string,
  Promise<CodingInterviewGenerationResult>
>();

function createDeterministicRandom(seed: string) {
  let state = 0;
  const normalizedSeed = seed || "coding-interview";

  for (let index = 0; index < normalizedSeed.length; index += 1) {
    state = (state * 31 + normalizedSeed.charCodeAt(index)) >>> 0;
  }

  if (state === 0) {
    state = 0x6d2b79f5;
  }

  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

export function buildCodingSourcePlan(
  interviewId: string,
  questionCount: number = CODING_INTERVIEW_QUESTION_COUNT,
): CodingProblemSource[] {
  const random = createDeterministicRandom(interviewId);

  return Array.from({ length: questionCount }, () =>
    random() < RESUME_SOURCE_PROBABILITY ? "resume" : "leetcode",
  );
}

function formatSourceLabel(source: CodingProblemSource) {
  return source === "resume" ? "岗位/简历相关" : "LeetCode 风格";
}

function buildProfileSummary(profile: GenerateCodingInterviewArgs["profile"]) {
  const skills = (profile.skills ?? []).filter(Boolean).slice(0, 8);
  const workLines = (profile.work_experiences ?? [])
    .slice(0, 2)
    .map((item, index) => {
      const company = item.company?.trim() || "未知公司";
      const position = item.position?.trim() || "未知岗位";
      const description = item.description?.trim() || "无补充说明";
      return `${index + 1}. ${company} / ${position}: ${description}`;
    });
  const projectLines = (profile.project_experiences ?? [])
    .slice(0, 3)
    .map((item, index) => {
      const name = item.project_name?.trim() || "未命名项目";
      const role = item.role?.trim() || "成员";
      const stack =
        (item.tech_stack ?? []).filter(Boolean).join("、") || "未注明技术栈";
      const description = item.description?.trim() || "无补充说明";
      return `${index + 1}. ${name}（${role}） / ${stack}: ${description}`;
    });

  return [
    `候选人目标方向：${profile.job_intention || "通用软件工程"}`,
    `候选人经验年限：${profile.experience_years ?? 0} 年`,
    `候选人核心技能：${skills.length > 0 ? skills.join("、") : "暂无明确技能"}`,
    workLines.length > 0
      ? `工作经历：\n${workLines.join("\n")}`
      : "工作经历：暂无",
    projectLines.length > 0
      ? `项目经历：\n${projectLines.join("\n")}`
      : "项目经历：暂无",
  ].join("\n");
}

function normalizeProblem(
  interviewId: string,
  problem: CodingInterviewSet["problems"][number],
  index: number,
): CodeProblem {
  return {
    id: `${interviewId}-problem-${index + 1}`,
    title: problem.title,
    difficulty: problem.difficulty,
    language: "javascript",
    sourceKind: problem.sourceKind,
    description: problem.description.trim(),
    examples: problem.examples.map((example) => ({
      input: example.input,
      output: example.output,
      explanation: example.explanation?.trim() || "",
    })),
    constraints: problem.constraints,
    solutionTemplate: problem.solutionTemplate,
    testTemplate: problem.testTemplate,
  };
}

function buildPrompt(args: {
  difficultyPlan: readonly string[];
  sourcePlan: CodingProblemSource[];
  profileSummary: string;
  referenceAlgorithms: string[];
  referenceProjects: string[];
}) {
  const algorithmReferences =
    args.referenceAlgorithms.length > 0
      ? args.referenceAlgorithms.map((item) => `- ${item}`).join("\n")
      : "- 暂无可用算法题参考，请自行生成常见高质量算法题";
  const projectReferences =
    args.referenceProjects.length > 0
      ? args.referenceProjects.map((item) => `- ${item}`).join("\n")
      : "- 暂无可用工程题参考，请基于候选人简历设计工程实现题";
  const sourcePlanSummary = args.sourcePlan
    .map((source, index) => `${index + 1}. ${formatSourceLabel(source)}`)
    .join("\n");

  return [
    "你是一名资深编程面试官，需要为候选人生成一个 3 题的专项编码面试。",
    `题目数量固定为 ${CODING_INTERVIEW_QUESTION_COUNT} 题。`,
    `题目来源按“岗位/简历相关 : LeetCode 风格 = ${CODING_INTERVIEW_RESUME_TO_LEETCODE_RATIO.resume}:${CODING_INTERVIEW_RESUME_TO_LEETCODE_RATIO.leetcode}”做概率加权；这是每题独立抽样的概率，不要求固定数量。`,
    `本次三题难度顺序固定为：${args.difficultyPlan.join(" -> ")}。`,
    "本场已经按上述概率抽样得到题型顺序，返回结果必须严格匹配以下来源顺序：",
    sourcePlanSummary,
    "所有题目必须满足以下要求：",
    "1. 全部输出中文题面。",
    "2. 编程语言固定为 JavaScript。",
    "3. solutionTemplate 必须包含函数签名和必要注释，不要直接给完整答案。",
    "4. testTemplate 必须是纯 JavaScript，可直接与 solutionTemplate 一起通过 new Function 执行，不依赖第三方库。",
    "5. sourceKind 必须与题型顺序一一对应。",
    "6. 岗位/简历相关题必须和候选人的经历、技能或目标岗位强相关；如果候选人是前端/客户端方向，可以直接出前端手写题、组件逻辑题、状态管理题等，不要求必须逐字引用简历项目。",
    "7. LeetCode 风格题要有明显周赛感：题意清晰、输入输出明确、包含边界场景。",
    "8. examples 至少 1 组，constraints 至少 1 条。",
    "",
    "候选人简历摘要：",
    args.profileSummary,
    "",
    "可参考的算法题方向：",
    algorithmReferences,
    "",
    "可参考的工程题方向：",
    projectReferences,
    "",
    "请严格按 schema 返回，不要输出额外说明。",
  ].join("\n");
}

function inferRoleLabel(profile: GenerateCodingInterviewArgs["profile"]) {
  const jobIntention = (profile.job_intention || "").toLowerCase();
  const skills = (profile.skills ?? []).map((item) => item.toLowerCase());
  if (
    jobIntention.includes("前端") ||
    jobIntention.includes("frontend") ||
    skills.some((item) => ["react", "vue", "typescript"].includes(item))
  ) {
    return "frontend";
  }
  if (
    jobIntention.includes("后端") ||
    jobIntention.includes("backend") ||
    skills.some((item) => ["java", "go", "mysql", "redis"].includes(item))
  ) {
    return "backend";
  }
  if (
    jobIntention.includes("移动") ||
    jobIntention.includes("mobile") ||
    skills.some((item) =>
      ["android", "ios", "flutter", "react native"].includes(item),
    )
  ) {
    return "mobile";
  }
  return "general";
}

function buildFrontendResumeProblem(
  difficulty: CodingInterviewSet["problems"][number]["difficulty"],
  variantIndex: number,
): CodingInterviewSet["problems"][number] {
  const problemFactories = [
    () => ({
      title: "实现轻量事件总线",
      difficulty,
      sourceKind: "resume" as const,
      description:
        "请实现 createEventBus()，返回一个事件总线对象，支持 on(event, handler)、off(event, handler)、emit(event, payload) 和 once(event, handler) 四个方法。\n\n要求：\n- 同一个事件可以注册多个处理函数。\n- off 只移除指定处理函数。\n- once 注册的处理函数只触发一次。\n- emit 返回本次实际触发的处理函数数量。",
      examples: [
        {
          input:
            'const bus = createEventBus(); bus.on("ready", fn1); bus.once("ready", fn2);',
          output: "第一次 emit 触发 2 个处理函数，第二次 emit 只触发 1 个。",
          explanation: "once 注册的处理函数执行后会自动移除。",
        },
      ],
      constraints: [
        "事件名为非空字符串",
        "最多注册与触发 10^4 次",
        "需要保持处理函数注册顺序",
      ],
      solutionTemplate: `function createEventBus() {
  // TODO
}
`,
      testTemplate: `function assertEqual(actual, expected, label) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? "✓" : "✗") + " " + label);
  if (!pass) console.error("  expected:", expected, "got:", actual);
}

const bus = createEventBus();
const logs = [];
const handlerA = (value) => logs.push("A:" + value);
const handlerB = (value) => logs.push("B:" + value);

bus.on("ready", handlerA);
bus.once("ready", handlerB);
assertEqual(bus.emit("ready", 1), 2, "emit triggers all handlers");
assertEqual(bus.emit("ready", 2), 1, "once handler only runs once");
bus.off("ready", handlerA);
assertEqual(bus.emit("ready", 3), 0, "off removes target handler");
assertEqual(logs, ["A:1", "B:1", "A:2"], "handler order is preserved");
`,
    }),
    () => ({
      title: "实现支持 leading/trailing 的防抖函数",
      difficulty,
      sourceKind: "resume" as const,
      description:
        "请实现 debounceAdvanced(fn, wait, options)，返回一个新的防抖函数。\n\n要求：\n- options.leading 为 true 时，第一次触发立即执行。\n- options.trailing 为 true 时，停止触发后补一次尾调用。\n- 返回的函数带有 cancel() 方法，用于取消待执行调用。\n- 本题只需要处理同步函数。",
      examples: [
        {
          input: "debounceAdvanced(fn, 100, { leading: true, trailing: true })",
          output: "首触发立即执行，连续调用结束后再执行一次。",
        },
      ],
      constraints: [
        "0 <= wait <= 10^4",
        "options 可能为空对象",
        "返回函数必须暴露 cancel 方法",
      ],
      solutionTemplate: `function debounceAdvanced(fn, wait, options = {}) {
  // TODO
}
`,
      testTemplate: `function assertEqual(actual, expected, label) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? "✓" : "✗") + " " + label);
  if (!pass) console.error("  expected:", expected, "got:", actual);
}

const calls = [];
let currentTime = 0;
const timers = [];

globalThis.setTimeout = (callback, delay) => {
  const timer = { callback, triggerAt: currentTime + delay, cancelled: false };
  timers.push(timer);
  return timer;
};

globalThis.clearTimeout = (timer) => {
  timer.cancelled = true;
};

function flushTo(time) {
  currentTime = time;
  timers
    .filter((timer) => !timer.cancelled && timer.triggerAt <= currentTime)
    .forEach((timer) => {
      timer.cancelled = true;
      timer.callback();
    });
}

const debounced = debounceAdvanced((value) => calls.push(value), 100, {
  leading: true,
  trailing: true,
});

debounced("A");
debounced("B");
flushTo(100);
assertEqual(calls, ["A", "B"], "leading and trailing both work");
debounced("C");
debounced.cancel();
flushTo(300);
assertEqual(calls, ["A", "B"], "cancel prevents pending trailing call");
`,
    }),
    () => ({
      title: "实现扁平路由转菜单树",
      difficulty,
      sourceKind: "resume" as const,
      description:
        "给定扁平路由数组 routes，其中每一项包含 id、parentId、title 和 path。请实现 buildMenuTree(routes)，按 parentId 构建菜单树。\n\n要求：\n- 根节点的 parentId 为 null。\n- 每个节点输出格式为 { id, title, path, children }。\n- children 需要保持原数组中的相对顺序。",
      examples: [
        {
          input:
            '[{ id: 1, parentId: null, title: "控制台" }, { id: 2, parentId: 1, title: "数据面板" }]',
          output:
            '[{ id: 1, title: "控制台", children: [{ id: 2, title: "数据面板", children: [] }] }]',
        },
      ],
      constraints: [
        "1 <= routes.length <= 10^4",
        "id 唯一",
        "输入保证 parentId 要么为 null，要么引用已存在节点",
      ],
      solutionTemplate: `function buildMenuTree(routes) {
  // TODO
}
`,
      testTemplate: `function simplify(nodes) {
  return nodes.map((node) => ({
    id: node.id,
    title: node.title,
    children: simplify(node.children || []),
  }));
}

function assertEqual(actual, expected, label) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? "✓" : "✗") + " " + label);
  if (!pass) console.error("  expected:", expected, "got:", actual);
}

const routes = [
  { id: 1, parentId: null, title: "控制台", path: "/dashboard" },
  { id: 2, parentId: 1, title: "数据面板", path: "/dashboard/data" },
  { id: 3, parentId: 1, title: "告警中心", path: "/dashboard/alert" },
  { id: 4, parentId: null, title: "设置", path: "/settings" },
];

assertEqual(
  simplify(buildMenuTree(routes)),
  [
    {
      id: 1,
      title: "控制台",
      children: [
        { id: 2, title: "数据面板", children: [] },
        { id: 3, title: "告警中心", children: [] },
      ],
    },
    { id: 4, title: "设置", children: [] },
  ],
  "build nested tree",
);
`,
    }),
  ];

  return problemFactories[variantIndex % problemFactories.length]();
}

function buildBackendResumeProblem(
  difficulty: CodingInterviewSet["problems"][number]["difficulty"],
  variantIndex: number,
  topSkill: string,
): CodingInterviewSet["problems"][number] {
  const problemFactories = [
    () => ({
      title: "实现带过期时间的内存缓存",
      difficulty,
      sourceKind: "resume" as const,
      description: `结合候选人在 ${topSkill} 相关场景下的工程经验，实现一个简化版 ExpiringCache。\n\n请实现 ExpiringCache 类，支持 set(key, value, ttlSeconds)、get(key) 和 count() 三个方法。\n- set 会写入/覆盖键值，并设置过期秒数。\n- get 在键不存在或已过期时返回 -1。\n- count 返回当前未过期键的数量。`,
      examples: [
        {
          input:
            '["ExpiringCache","set","get","count","get"]\\n[[],["token",42,5],["token"],[],["missing"]]',
          output: "[null,null,42,1,-1]",
          explanation: "token 在有效期内可读，missing 不存在时返回 -1。",
        },
      ],
      constraints: [
        "1 <= ttlSeconds <= 10^4",
        "最多调用 10^4 次方法",
        "不需要处理真实时间流逝，测试会通过覆写时间戳模拟",
      ],
      solutionTemplate: `class ExpiringCache {
  constructor(now = () => Date.now()) {
    this.now = now;
    this.store = new Map();
  }

  set(key, value, ttlSeconds) {
    // TODO
  }

  get(key) {
    // TODO
  }

  count() {
    // TODO
  }
}
`,
      testTemplate: `function assertEqual(actual, expected, label) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? "✓" : "✗") + " " + label);
  if (!pass) console.error("  expected:", expected, "got:", actual);
}

let nowValue = 1_000;
const cache = new ExpiringCache(() => nowValue);

cache.set("token", 42, 5);
assertEqual(cache.get("token"), 42, "can read active key");
assertEqual(cache.count(), 1, "count active key");

nowValue += 6_000;
assertEqual(cache.get("token"), -1, "expired key returns -1");
assertEqual(cache.count(), 0, "expired key removed from count");
`,
    }),
    () => ({
      title: "实现固定窗口限流器",
      difficulty,
      sourceKind: "resume" as const,
      description:
        "请实现 createRateLimiter(limit, windowSizeMs)，返回一个 allow(timestamp) 函数。\n\n要求：\n- 在同一个时间窗口内最多允许 limit 次请求。\n- 超出 limit 后返回 false，否则返回 true。\n- 新窗口开始后需要重新计数。",
      examples: [
        {
          input:
            "limit = 2, windowSizeMs = 1000，连续请求时间戳为 [100, 200, 300]",
          output: "[true, true, false]",
        },
      ],
      constraints: [
        "1 <= limit <= 10^4",
        "1 <= windowSizeMs <= 10^9",
        "timestamp 非递减",
      ],
      solutionTemplate: `function createRateLimiter(limit, windowSizeMs) {
  // TODO
}
`,
      testTemplate: `function assertEqual(actual, expected, label) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? "✓" : "✗") + " " + label);
  if (!pass) console.error("  expected:", expected, "got:", actual);
}

const allow = createRateLimiter(2, 1000);
assertEqual(allow(100), true, "first request allowed");
assertEqual(allow(200), true, "second request allowed");
assertEqual(allow(300), false, "third request rejected");
assertEqual(allow(1200), true, "new window resets counter");
`,
    }),
    () => ({
      title: "实现批量请求调度器",
      difficulty,
      sourceKind: "resume" as const,
      description: `结合候选人在 ${topSkill} 相关项目中的工程经验，实现一个纯函数版的批量请求调度器。\n\n请实现 scheduleBatches(tasks, batchSize)，其中 tasks 为待执行任务名数组，batchSize 表示每一批最多处理多少个任务。\n返回结果需要按批次切分，例如 ["a","b","c","d"] 和 batchSize=2 时，返回 [["a","b"],["c","d"]]。\n如果 batchSize 非法，返回空数组。`,
      examples: [
        {
          input: 'tasks = ["img-1","img-2","img-3","img-4"], batchSize = 2',
          output: '[["img-1","img-2"],["img-3","img-4"]]',
          explanation: "每批最多两个任务，按原顺序切分。",
        },
      ],
      constraints: [
        "0 <= tasks.length <= 10^4",
        "1 <= batchSize <= 10^3",
        "返回结果必须保持原始顺序",
      ],
      solutionTemplate: `function scheduleBatches(tasks, batchSize) {
  // TODO
}
`,
      testTemplate: `function assertEqual(actual, expected, label) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? "✓" : "✗") + " " + label);
  if (!pass) console.error("  expected:", expected, "got:", actual);
}

assertEqual(
  scheduleBatches(["img-1", "img-2", "img-3", "img-4"], 2),
  [["img-1", "img-2"], ["img-3", "img-4"]],
  "split into batches",
);
assertEqual(
  scheduleBatches(["job-1", "job-2", "job-3"], 5),
  [["job-1", "job-2", "job-3"]],
  "single batch when batch size is large",
);
assertEqual(scheduleBatches(["only"], 0), [], "invalid batch size");
`,
    }),
  ];

  return problemFactories[variantIndex % problemFactories.length]();
}

function buildMobileResumeProblem(
  difficulty: CodingInterviewSet["problems"][number]["difficulty"],
  variantIndex: number,
): CodingInterviewSet["problems"][number] {
  const problemFactories = [
    () => ({
      title: "实现离线操作队列合并",
      difficulty,
      sourceKind: "resume" as const,
      description:
        "移动端网络不稳定时，会把操作先记录到本地队列。请实现 mergeOfflineActions(actions)，对同一条记录的连续操作进行压缩。\n\n规则：\n- create 后紧跟 delete，两个操作相互抵消。\n- update 只保留最后一次。\n- 不同 id 之间互不影响，最终保持首次出现的 id 顺序。",
      examples: [
        {
          input:
            '[{ id: "1", type: "create" }, { id: "1", type: "delete" }, { id: "2", type: "update", value: 1 }, { id: "2", type: "update", value: 3 }]',
          output: '[{ id: "2", type: "update", value: 3 }]',
        },
      ],
      constraints: [
        "0 <= actions.length <= 10^4",
        "type 只会是 create/update/delete",
        "最终结果按首次出现 id 的顺序输出",
      ],
      solutionTemplate: `function mergeOfflineActions(actions) {
  // TODO
}
`,
      testTemplate: `function assertEqual(actual, expected, label) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? "✓" : "✗") + " " + label);
  if (!pass) console.error("  expected:", expected, "got:", actual);
}

assertEqual(
  mergeOfflineActions([
    { id: "1", type: "create" },
    { id: "1", type: "delete" },
    { id: "2", type: "update", value: 1 },
    { id: "2", type: "update", value: 3 },
  ]),
  [{ id: "2", type: "update", value: 3 }],
  "compress consecutive actions",
);
`,
    }),
    () => ({
      title: "实现消息去重同步器",
      difficulty,
      sourceKind: "resume" as const,
      description:
        "请实现 syncMessages(localMessages, remoteMessages)，合并本地与远端消息列表。\n\n要求：\n- messageId 相同的消息只保留 updatedAt 更大的那条。\n- 结果按 updatedAt 升序返回。\n- 输入数组本身不保证有序。",
      examples: [
        {
          input:
            'local = [{ messageId: "a", updatedAt: 3 }], remote = [{ messageId: "a", updatedAt: 5 }, { messageId: "b", updatedAt: 4 }]',
          output:
            '[{ messageId: "b", updatedAt: 4 }, { messageId: "a", updatedAt: 5 }]',
        },
      ],
      constraints: [
        "0 <= 消息总数 <= 10^4",
        "messageId 为字符串",
        "updatedAt 为非负整数",
      ],
      solutionTemplate: `function syncMessages(localMessages, remoteMessages) {
  // TODO
}
`,
      testTemplate: `function assertEqual(actual, expected, label) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? "✓" : "✗") + " " + label);
  if (!pass) console.error("  expected:", expected, "got:", actual);
}

assertEqual(
  syncMessages(
    [{ messageId: "a", updatedAt: 3, text: "old" }],
    [
      { messageId: "a", updatedAt: 5, text: "new" },
      { messageId: "b", updatedAt: 4, text: "hello" },
    ],
  ),
  [
    { messageId: "b", updatedAt: 4, text: "hello" },
    { messageId: "a", updatedAt: 5, text: "new" },
  ],
  "merge and sort by updatedAt",
);
`,
    }),
    () => ({
      title: "实现滚动窗口预取计划器",
      difficulty,
      sourceKind: "resume" as const,
      description:
        "请实现 buildPrefetchWindows(pages, windowSize)，把待预取页码列表按滚动窗口切分。\n\n要求：\n- 每个窗口长度最多为 windowSize。\n- 相邻窗口之间需要有 1 页重叠，以模拟滚动预加载。\n- 如果 windowSize <= 1，直接按单页窗口返回。",
      examples: [
        {
          input: "pages = [1,2,3,4,5], windowSize = 3",
          output: "[[1,2,3],[3,4,5]]",
        },
      ],
      constraints: [
        "0 <= pages.length <= 10^4",
        "windowSize >= 1",
        "保持页码原顺序",
      ],
      solutionTemplate: `function buildPrefetchWindows(pages, windowSize) {
  // TODO
}
`,
      testTemplate: `function assertEqual(actual, expected, label) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? "✓" : "✗") + " " + label);
  if (!pass) console.error("  expected:", expected, "got:", actual);
}

assertEqual(
  buildPrefetchWindows([1, 2, 3, 4, 5], 3),
  [[1, 2, 3], [3, 4, 5]],
  "overlap windows by one page",
);
assertEqual(buildPrefetchWindows([7, 8], 1), [[7], [8]], "single page window");
`,
    }),
  ];

  return problemFactories[variantIndex % problemFactories.length]();
}

function buildGeneralResumeProblem(
  difficulty: CodingInterviewSet["problems"][number]["difficulty"],
  variantIndex: number,
  topSkill: string,
): CodingInterviewSet["problems"][number] {
  return buildBackendResumeProblem(difficulty, variantIndex, topSkill);
}

function buildResumeProblem(args: {
  roleLabel: ReturnType<typeof inferRoleLabel>;
  difficulty: CodingInterviewSet["problems"][number]["difficulty"];
  variantIndex: number;
  topSkill: string;
}): CodingInterviewSet["problems"][number] {
  if (args.roleLabel === "frontend") {
    return buildFrontendResumeProblem(args.difficulty, args.variantIndex);
  }
  if (args.roleLabel === "backend") {
    return buildBackendResumeProblem(
      args.difficulty,
      args.variantIndex,
      args.topSkill,
    );
  }
  if (args.roleLabel === "mobile") {
    return buildMobileResumeProblem(args.difficulty, args.variantIndex);
  }
  return buildGeneralResumeProblem(
    args.difficulty,
    args.variantIndex,
    args.topSkill,
  );
}

function buildAlgorithmProblem(
  difficulty: CodingInterviewSet["problems"][number]["difficulty"],
  variantIndex: number,
): CodingInterviewSet["problems"][number] {
  const problemFactories = [
    () => ({
      title: "数组中出现频率前 K 高的元素",
      difficulty,
      sourceKind: "leetcode" as const,
      description:
        "给定一个整数数组 nums 和一个整数 k，请返回出现频率前 k 高的元素，返回顺序不限。",
      examples: [
        {
          input: "nums = [1,1,1,2,2,3], k = 2",
          output: "[1,2]",
          explanation: "1 出现 3 次，2 出现 2 次。",
        },
      ],
      constraints: [
        "1 <= nums.length <= 10^5",
        "-10^4 <= nums[i] <= 10^4",
        "1 <= k <= 不同元素个数",
      ],
      solutionTemplate: `function topKFrequent(nums, k) {
  // TODO
}
`,
      testTemplate: `function normalize(arr) {
  return [...arr].sort((a, b) => a - b);
}

function assertEqual(actual, expected, label) {
  const pass = JSON.stringify(normalize(actual)) === JSON.stringify(normalize(expected));
  console.log((pass ? "✓" : "✗") + " " + label);
  if (!pass) console.error("  expected:", expected, "got:", actual);
}

assertEqual(topKFrequent([1, 1, 1, 2, 2, 3], 2), [1, 2], "basic case");
assertEqual(topKFrequent([4, 4, 4, 6, 6, 7], 1), [4], "top one");
`,
    }),
    () => ({
      title: "合并重叠区间",
      difficulty,
      sourceKind: "leetcode" as const,
      description:
        "给定若干区间 intervals，其中 intervals[i] = [start, end]。请合并所有重叠区间，并返回一个不重叠的区间数组。",
      examples: [
        {
          input: "intervals = [[1,3],[2,6],[8,10],[15,18]]",
          output: "[[1,6],[8,10],[15,18]]",
          explanation: "[1,3] 和 [2,6] 存在重叠。",
        },
      ],
      constraints: [
        "1 <= intervals.length <= 10^4",
        "intervals[i].length === 2",
        "0 <= start <= end <= 10^4",
      ],
      solutionTemplate: `function mergeIntervals(intervals) {
  // TODO
}
`,
      testTemplate: `function assertEqual(actual, expected, label) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? "✓" : "✗") + " " + label);
  if (!pass) console.error("  expected:", expected, "got:", actual);
}

assertEqual(
  mergeIntervals([[1, 3], [2, 6], [8, 10], [15, 18]]),
  [[1, 6], [8, 10], [15, 18]],
  "merge overlaps",
);
assertEqual(
  mergeIntervals([[1, 4], [4, 5]]),
  [[1, 5]],
  "touching intervals merge",
);
`,
    }),
    () => ({
      title: "最长不重复子串",
      difficulty,
      sourceKind: "leetcode" as const,
      description: "给定一个字符串 s，请返回其中不含重复字符的最长子串长度。",
      examples: [
        {
          input: 's = "abcabcbb"',
          output: "3",
          explanation: '最长不重复子串是 "abc"。',
        },
      ],
      constraints: [
        "0 <= s.length <= 5 * 10^4",
        "s 由英文字母、数字、符号和空格组成",
      ],
      solutionTemplate: `function lengthOfLongestSubstring(s) {
  // TODO
}
`,
      testTemplate: `function assertEqual(actual, expected, label) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected);
  console.log((pass ? "✓" : "✗") + " " + label);
  if (!pass) console.error("  expected:", expected, "got:", actual);
}

assertEqual(lengthOfLongestSubstring("abcabcbb"), 3, "basic case");
assertEqual(lengthOfLongestSubstring("bbbbb"), 1, "all same chars");
assertEqual(lengthOfLongestSubstring("pwwkew"), 3, "window moves forward");
`,
    }),
  ];

  return problemFactories[variantIndex % problemFactories.length]();
}

function buildFallbackProblemSet(
  args: GenerateCodingInterviewArgs,
): CodeProblem[] {
  const parsed = parseInterviewType(args.interview.type);
  const difficultyPlan = DIFFICULTY_PLANS[parsed.difficulty ?? "intermediate"];
  const roleLabel = inferRoleLabel(args.profile);
  const topSkill = (args.profile.skills ?? []).find(Boolean) || "工程实现";
  const sourcePlan = buildCodingSourcePlan(args.interviewId);
  let resumeIndex = 0;
  let leetcodeIndex = 0;

  return sourcePlan.map((sourceKind, index) =>
    normalizeProblem(
      args.interviewId,
      sourceKind === "resume"
        ? buildResumeProblem({
            roleLabel,
            difficulty: difficultyPlan[index],
            variantIndex: resumeIndex++,
            topSkill,
          })
        : buildAlgorithmProblem(difficultyPlan[index], leetcodeIndex++),
      index,
    ),
  );
}

async function generateCodingInterviewProblemsCore(
  args: GenerateCodingInterviewArgs,
): Promise<CodeProblem[]> {
  const parsedType = parseInterviewType(args.interview.type);
  const difficultyPlan =
    DIFFICULTY_PLANS[parsedType.difficulty ?? "intermediate"];
  const candidateProfile = buildCandidateProfile({
    job_intention: args.profile.job_intention,
    experience_years: args.profile.experience_years,
    company_intention: args.profile.company_intention,
    skills: args.profile.skills,
  });

  let referenceAssets: Awaited<ReturnType<typeof loadQuestionAssets>> = [];
  try {
    referenceAssets = await loadQuestionAssets({
      roleFamily: candidateProfile.roleFamily,
      seniority: candidateProfile.seniority,
      companyTag: args.profile.company_intention || undefined,
      limit: 16,
    });
  } catch (error) {
    console.warn("[coding-interview] loadQuestionAssets failed", error);
  }

  const algorithmReferences = referenceAssets
    .filter((item) => item.questionType === "algorithm")
    .slice(0, 5)
    .map((item) => item.questionText);
  const projectReferences = referenceAssets
    .filter(
      (item) =>
        item.questionType === "project" ||
        item.questionType === "system_design",
    )
    .slice(0, 4)
    .map((item) => item.questionText);

  const llmConfig = validateLlmConfig();
  if (!llmConfig.isValid) {
    return buildFallbackProblemSet(args);
  }

  try {
    const sourcePlan = buildCodingSourcePlan(args.interviewId);
    const model = createLangChainChatModelForUseCase({
      useCase: "question-predict",
      temperature: 0.35,
      maxTokens: 7000,
    }).withStructuredOutput(codingInterviewSetSchema, {
      method: "functionCalling",
    });

    const response = await model.invoke([
      {
        role: "system",
        content: buildPrompt({
          difficultyPlan,
          sourcePlan,
          profileSummary: buildProfileSummary(args.profile),
          referenceAlgorithms: algorithmReferences,
          referenceProjects: projectReferences,
        }),
      },
      {
        role: "user",
        content: `请为 interviewId=${args.interviewId} 生成本次专项编码题集。`,
      },
    ]);

    const matchesSourcePlan = response.problems.every(
      (problem, index) => problem.sourceKind === sourcePlan[index],
    );

    if (!matchesSourcePlan) {
      throw new Error("Generated source plan mismatch");
    }

    return response.problems.map((problem, index) =>
      normalizeProblem(args.interviewId, problem, index),
    );
  } catch (error) {
    console.error("[coding-interview] generation failed, use fallback", error);
    return buildFallbackProblemSet(args);
  }
}

export async function generateCodingInterviewProblems(
  args: GenerateCodingInterviewArgs,
): Promise<CodeProblem[]> {
  const result = await getOrGenerateCodingInterviewProblems(args);
  return result.problems;
}

export function clearCodingInterviewProblemCache() {
  resolvedProblemCache.clear();
  inflightProblemCache.clear();
}

function createGenerationTimeoutPromise(
  args: GenerateCodingInterviewArgs,
  timeoutMs: number,
) {
  return new Promise<CodingInterviewGenerationResult>((resolve) => {
    setTimeout(() => {
      resolve({
        problems: buildFallbackProblemSet(args),
        source: "timeout-fallback",
      });
    }, timeoutMs);
  });
}

export async function getOrGenerateCodingInterviewProblems(
  args: GenerateCodingInterviewArgs,
  timeoutMs: number = CODING_INTERVIEW_GENERATION_TIMEOUT_MS,
): Promise<CodingInterviewGenerationResult> {
  const cached = resolvedProblemCache.get(args.interviewId);
  if (cached) {
    return cached;
  }

  let inflight = inflightProblemCache.get(args.interviewId);
  if (!inflight) {
    inflight = generateCodingInterviewProblemsCore(args)
      .then((problems) => {
        const result: CodingInterviewGenerationResult = {
          problems,
          source: "llm",
        };
        resolvedProblemCache.set(args.interviewId, result);
        return result;
      })
      .catch((error) => {
        console.error(
          "[coding-interview] generation failed, use fallback",
          error,
        );
        const result: CodingInterviewGenerationResult = {
          problems: buildFallbackProblemSet(args),
          source: "fallback",
        };
        resolvedProblemCache.set(args.interviewId, result);
        return result;
      })
      .finally(() => {
        inflightProblemCache.delete(args.interviewId);
      });

    inflightProblemCache.set(args.interviewId, inflight);
  }

  const timedResult = await Promise.race([
    inflight,
    createGenerationTimeoutPromise(args, timeoutMs),
  ]);

  if (!resolvedProblemCache.has(args.interviewId)) {
    resolvedProblemCache.set(args.interviewId, timedResult);
  }

  return timedResult;
}
