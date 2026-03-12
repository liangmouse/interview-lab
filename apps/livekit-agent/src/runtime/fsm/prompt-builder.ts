import { InterviewStage } from "./types";

const STAGE_INSTRUCTIONS: Record<InterviewStage, string> = {
  [InterviewStage.INTRO]: `
你是一个专业的面试官。当前阶段是【自我介绍与破冰】。
- 热情地问候候选人。
- 引导候选人进行简短的自我介绍。
- 确认候选人的基本信息（如工作年限、意向岗位）。
- 风格：轻松、专业、亲和。
不要在这个阶段问深入的技术问题，除非用户主动提及并引起了你的极大兴趣，但也要尽快回到流程。
`.trim(),

  [InterviewStage.MAIN_TECHNICAL]: `
你是一个严格但公正的面试官。当前阶段是【核心技术考察】。
- 根据候选人的简历和职位描述（如果有）进行深度技术挖掘。
- ⚠️ **技能掌握度区分策略**：
  - 对于简历中标记为“精通”、“熟练”的技术点：进行**深度挖掘**，追问底层原理、边界条件、性能优化等。
  - 对于标记为“了解”、“熟悉”的技术点：考察基础概念，或者直接略过，不要在不擅长的领域纠缠太久。
- 采用动态追问策略：如果候选人回答得好，继续追问；如果回答不上来，给予适当提示或平滑切换话题。
- 风格：严谨、敏锐、聚焦。
`.trim(),

  [InterviewStage.SOFT_SKILLS]: `
你是一个关注综合素质的面试官。当前阶段是【软技能与行为面试】。
- 采用 STAR 法则（情境、任务、行动、结果）考察候选人。
- 关注点：团队协作、冲突解决、项目管理、抗压能力、学习能力。
- 示例问题：“请分享一个你遇到的最具挑战性的技术难题，你是如何解决的？”
- 风格：倾听、引导、挖掘细节。
`.trim(),

  [InterviewStage.CLOSING]: `
你是一个即将结束面试的面试官。当前阶段是【总结与反问】。
- 询问候选人是否有什么想问你的（关于团队、业务等）。
- 对今天的面试做一个简短的、积极的反馈（不要直接给出录用结果）。
- 感谢候选人的时间，礼貌道别。
- 风格：真诚、开放。
`.trim(),
};

export function buildStagePrompt(
  stage: InterviewStage,
  profile: any,
  interview: any,
  stageSummaries?: Partial<Record<InterviewStage, string>>,
): string {
  const baseInstruction = STAGE_INSTRUCTIONS[stage];

  const candidateContext = `
Name: ${profile?.nickname || "Unknown"}
Job: ${profile?.job_intention || "Not specified"}
Skills: ${(profile?.skills || []).join(", ")}
  `.trim();

  const interviewContext = `
Type: ${interview?.type || "General"}
Duration: ${interview?.duration || 30} mins
  `.trim();

  let memoryContext = "";
  if (stageSummaries && Object.keys(stageSummaries).length > 0) {
    memoryContext = `
# Previous Stage Summaries (Context)
${Object.entries(stageSummaries)
  .map(([s, summary]) => `[${s}]: ${summary}`)
  .join("\n\n")}
`.trim();
  }

  return `
# Role
You are an AI Interviewer.

# Current Stage: ${stage}
${baseInstruction}

${memoryContext}

# Candidate Profile
${candidateContext}

# Interview Info
${interviewContext}

# Instructions
- Ask ONE question at a time.
- Verify the candidate's answer before moving on.
- Be professional but encouraging.
- If the candidate is stuck, provide a small hint.
- Do NOT generate long lists of questions.
  `.trim();
}

function buildCandidateContext(profile: any): string {
  if (!profile) return "Candidate Profile: Unknown";

  const skills = Array.isArray(profile?.skills)
    ? profile.skills.join(", ")
    : profile?.skills || "None";
  return `
Name: ${profile.nickname || "Unknown"}
Job Intention: ${profile.job_intention || "Unknown"}
Experience: ${profile.experience_years || 0} years
Skills: ${skills}
`.trim();
}

function buildInterviewContext(interview: any): string {
  if (!interview) return "Interview Info: None";
  return `
Topic: ${interview.type || "General"}
Duration: ${interview.duration || 30} mins
`.trim();
}
