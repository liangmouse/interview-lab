import type {
  UserProfile,
  WorkExperience,
  ProjectExperience,
} from "@/types/profile";
import { sanitizeProfileData } from "@/lib/security/prompt-injection";

/**
 * 用户资料RAG处理服务
 * 负责将用户资料信息转换为面试官可用的结构化数据
 */

export interface PersonalizedInterviewContext {
  // 基本信息
  basicInfo: {
    nickname?: string;
    jobIntention?: string;
    companyIntention?: string;
    experienceYears?: number;
    skills?: string[];
    bio?: string;
  };

  // 工作经历摘要
  workExperienceSummary: {
    totalExperience: number;
    keyCompanies: string[];
    keyPositions: string[];
    careerProgression: string;
    industryBackground: string[];
  };

  // 项目经历摘要
  projectExperienceSummary: {
    totalProjects: number;
    keyTechnologies: string[];
    projectTypes: string[];
    leadershipRoles: string[];
    technicalDepth: string;
  };

  // 面试重点领域
  interviewFocusAreas: {
    technicalSkills: string[];
    behavioralQuestions: string[];
    industrySpecificQuestions: string[];
    careerGoalQuestions: string[];
  };
}

/**
 * 从用户资料中提取个性化面试上下文
 */
export function extractPersonalizedContext(
  userProfile: UserProfile,
): PersonalizedInterviewContext {
  // 清理用户资料数据，防止注入
  const basicInfo = {
    nickname: userProfile.nickname
      ? sanitizeProfileData(userProfile.nickname)
      : undefined,
    jobIntention: userProfile.job_intention
      ? sanitizeProfileData(userProfile.job_intention)
      : undefined,
    companyIntention: userProfile.company_intention
      ? sanitizeProfileData(userProfile.company_intention)
      : undefined,
    experienceYears: userProfile.experience_years || undefined,
    skills: userProfile.skills
      ? userProfile.skills.map((skill) => sanitizeProfileData(skill))
      : undefined,
    bio: userProfile.bio ? sanitizeProfileData(userProfile.bio) : undefined,
  };

  const workExperienceSummary = analyzeWorkExperience(
    userProfile.work_experiences || [],
  );
  const projectExperienceSummary = analyzeProjectExperience(
    userProfile.project_experiences || [],
  );
  const interviewFocusAreas = generateInterviewFocusAreas(userProfile);

  return {
    basicInfo,
    workExperienceSummary,
    projectExperienceSummary,
    interviewFocusAreas,
  };
}

/**
 * 分析工作经历
 */
function analyzeWorkExperience(
  workExperiences: WorkExperience[],
): PersonalizedInterviewContext["workExperienceSummary"] {
  if (!workExperiences.length) {
    return {
      totalExperience: 0,
      keyCompanies: [],
      keyPositions: [],
      careerProgression: "无工作经历",
      industryBackground: [],
    };
  }

  // 清理工作经历数据
  const keyCompanies = workExperiences
    .map((exp) => (exp.company ? sanitizeProfileData(exp.company) : null))
    .filter(Boolean) as string[];
  const keyPositions = workExperiences
    .map((exp) => (exp.position ? sanitizeProfileData(exp.position) : null))
    .filter(Boolean) as string[];

  // 分析职业发展轨迹
  const careerProgression = analyzeCareerProgression(workExperiences);

  // 分析行业背景
  const industryBackground = analyzeIndustryBackground(workExperiences);

  return {
    totalExperience: workExperiences.length,
    keyCompanies,
    keyPositions,
    careerProgression,
    industryBackground,
  };
}

/**
 * 分析项目经历
 */
function analyzeProjectExperience(
  projectExperiences: ProjectExperience[],
): PersonalizedInterviewContext["projectExperienceSummary"] {
  if (!projectExperiences.length) {
    return {
      totalProjects: 0,
      keyTechnologies: [],
      projectTypes: [],
      leadershipRoles: [],
      technicalDepth: "无项目经历",
    };
  }

  // 提取技术栈
  const allTechStack = projectExperiences.flatMap(
    (proj) => proj.tech_stack || [],
  );
  const keyTechnologies = [...new Set(allTechStack)];

  // 分析项目类型
  const projectTypes = analyzeProjectTypes(projectExperiences);

  // 分析领导角色
  const leadershipRoles = projectExperiences
    .map((proj) => proj.role)
    .filter(
      (role) =>
        role &&
        (role.includes("负责") ||
          role.includes("主导") ||
          role.includes("领导") ||
          role.includes("架构师")),
    );

  // 分析技术深度
  const technicalDepth = analyzeTechnicalDepth(projectExperiences);

  return {
    totalProjects: projectExperiences.length,
    keyTechnologies,
    projectTypes,
    leadershipRoles,
    technicalDepth,
  };
}

/**
 * 生成面试重点领域
 */
function generateInterviewFocusAreas(
  userProfile: UserProfile,
): PersonalizedInterviewContext["interviewFocusAreas"] {
  const technicalSkills = userProfile.skills || [];

  // 基于求职意向生成行为问题
  const behavioralQuestions = generateBehavioralQuestions(userProfile);

  // 基于行业和公司意向生成行业特定问题
  const industrySpecificQuestions = generateIndustryQuestions(userProfile);

  // 基于职业规划生成职业目标问题
  const careerGoalQuestions = generateCareerGoalQuestions(userProfile);

  return {
    technicalSkills,
    behavioralQuestions,
    industrySpecificQuestions,
    careerGoalQuestions,
  };
}

/**
 * 分析职业发展轨迹
 */
function analyzeCareerProgression(workExperiences: WorkExperience[]): string {
  if (workExperiences.length <= 1) {
    return workExperiences.length === 1 ? "单一工作经历" : "无工作经历";
  }

  // 简单的职业发展分析
  const positions = workExperiences.map((exp) => exp.position.toLowerCase());

  if (
    positions.some(
      (pos) =>
        pos.includes("senior") || pos.includes("高级") || pos.includes("资深"),
    )
  ) {
    return "有高级职位经验";
  } else if (
    positions.some(
      (pos) =>
        pos.includes("lead") || pos.includes("主管") || pos.includes("经理"),
    )
  ) {
    return "有管理经验";
  } else {
    return "技术发展路径";
  }
}

/**
 * 分析行业背景
 */
function analyzeIndustryBackground(
  workExperiences: WorkExperience[],
): string[] {
  // 基于公司名称和描述简单推断行业
  const industries = new Set<string>();

  workExperiences.forEach((exp) => {
    // 清理描述数据
    const description = exp.description
      ? sanitizeProfileData(exp.description).toLowerCase()
      : "";
    const company = exp.company
      ? sanitizeProfileData(exp.company).toLowerCase()
      : "";

    if (
      company.includes("tech") ||
      company.includes("科技") ||
      description.includes("技术")
    ) {
      industries.add("科技");
    }
    if (
      company.includes("finance") ||
      company.includes("金融") ||
      description.includes("金融")
    ) {
      industries.add("金融");
    }
    if (
      company.includes("internet") ||
      company.includes("互联网") ||
      description.includes("互联网")
    ) {
      industries.add("互联网");
    }
    // 可以继续扩展更多行业识别逻辑
  });

  return Array.from(industries);
}

/**
 * 分析项目类型
 */
function analyzeProjectTypes(
  projectExperiences: ProjectExperience[],
): string[] {
  const types = new Set<string>();

  projectExperiences.forEach((proj) => {
    // 清理项目数据
    const name = proj.project_name
      ? sanitizeProfileData(proj.project_name).toLowerCase()
      : "";
    const description = proj.description
      ? sanitizeProfileData(proj.description).toLowerCase()
      : "";

    if (
      name.includes("web") ||
      description.includes("网站") ||
      description.includes("前端")
    ) {
      types.add("Web开发");
    }
    if (
      name.includes("mobile") ||
      name.includes("app") ||
      description.includes("移动") ||
      description.includes("手机")
    ) {
      types.add("移动开发");
    }
    if (
      description.includes("后端") ||
      description.includes("服务器") ||
      description.includes("api")
    ) {
      types.add("后端开发");
    }
    if (
      description.includes("数据") ||
      description.includes("分析") ||
      description.includes("算法")
    ) {
      types.add("数据分析");
    }
    // 可以继续扩展更多项目类型识别逻辑
  });

  return Array.from(types);
}

/**
 * 分析技术深度
 */
function analyzeTechnicalDepth(
  projectExperiences: ProjectExperience[],
): string {
  const allTechStack = projectExperiences.flatMap(
    (proj) => proj.tech_stack || [],
  );
  const uniqueTech = new Set(allTechStack);

  if (uniqueTech.size >= 10) {
    return "技术栈广泛，涉及多个领域";
  } else if (uniqueTech.size >= 5) {
    return "技术栈较为丰富";
  } else if (uniqueTech.size >= 2) {
    return "有一定技术积累";
  } else {
    return "技术栈相对单一";
  }
}

/**
 * 生成行为问题
 */
function generateBehavioralQuestions(userProfile: UserProfile): string[] {
  const questions = [];

  if (userProfile.work_experiences && userProfile.work_experiences.length > 0) {
    questions.push("团队协作经验");
    questions.push("项目管理能力");
    questions.push("问题解决能力");
  }

  if (
    userProfile.project_experiences &&
    userProfile.project_experiences.length > 0
  ) {
    questions.push("技术选型决策");
    questions.push("项目难点克服");
  }

  if (userProfile.experience_years && userProfile.experience_years > 3) {
    questions.push("领导力表现");
    questions.push("职业发展规划");
  }

  return questions;
}

/**
 * 生成行业特定问题
 */
function generateIndustryQuestions(userProfile: UserProfile): string[] {
  const questions = [];
  const jobIntention = userProfile.job_intention?.toLowerCase() || "";

  if (jobIntention.includes("前端") || jobIntention.includes("frontend")) {
    questions.push("前端性能优化");
    questions.push("用户体验设计");
    questions.push("前端工程化");
  }

  if (jobIntention.includes("后端") || jobIntention.includes("backend")) {
    questions.push("系统架构设计");
    questions.push("数据库优化");
    questions.push("微服务架构");
  }

  if (jobIntention.includes("全栈") || jobIntention.includes("fullstack")) {
    questions.push("全栈技术选型");
    questions.push("前后端协作");
  }

  return questions;
}

/**
 * 生成职业目标问题
 */
function generateCareerGoalQuestions(userProfile: UserProfile): string[] {
  const questions = [];

  if (userProfile.job_intention) {
    questions.push("职业目标规划");
    questions.push("技能发展计划");
  }

  if (userProfile.company_intention) {
    questions.push("公司选择标准");
    questions.push("职业价值观");
  }

  questions.push("未来发展方向");

  return questions;
}

/**
 * 生成简洁的面试开场提示词（仅用于初始化阶段）
 */
export function generateSimpleInterviewPrompt(
  context: PersonalizedInterviewContext,
): string {
  const { basicInfo } = context;

  let prompt = `你是一位专业的AI面试官。`;

  // 数据已在 extractPersonalizedContext 中清理，这里直接使用
  if (basicInfo.nickname) {
    prompt += ` 候选人姓名：${basicInfo.nickname}。`;
  }

  if (basicInfo.jobIntention) {
    prompt += ` 面试岗位：${basicInfo.jobIntention}。`;
  }

  prompt += ` 

请严格按照以下要求开始面试：
1. 欢迎语不超过15个字
2. 只提及姓名和岗位（如果有）
3. 直接引导候选人自我介绍
4. 不要提及具体的技术栈、公司经历或详细背景
5. 语言简洁直接，避免冗长描述

示例格式："你好{姓名}，欢迎参加{岗位}面试。请先做个简单的自我介绍。"`;

  return prompt;
}

/**
 * 将个性化上下文转换为面试提示词（用于后续对话）
 */
export function generatePersonalizedInterviewPrompt(
  context: PersonalizedInterviewContext,
): string {
  const {
    basicInfo,
    workExperienceSummary,
    projectExperienceSummary,
    interviewFocusAreas: _interviewFocusAreas,
  } = context;

  let prompt = `你是一位资深的AI面试官，正在面试一位候选人。以下是候选人的详细背景信息，请基于这些信息进行个性化的面试：

## 候选人基本信息
`;

  if (basicInfo.nickname) {
    prompt += `- 姓名：${basicInfo.nickname}\n`;
  }

  if (basicInfo.jobIntention) {
    prompt += `- 求职意向：${basicInfo.jobIntention}\n`;
  }

  if (basicInfo.companyIntention) {
    prompt += `- 目标公司：${basicInfo.companyIntention}\n`;
  }

  if (basicInfo.experienceYears) {
    prompt += `- 工作年限：${basicInfo.experienceYears}年\n`;
  }

  if (basicInfo.skills && basicInfo.skills.length > 0) {
    prompt += `- 技能标签：${basicInfo.skills.join(", ")}\n`;
  }

  if (basicInfo.bio) {
    prompt += `- 个人简介：${basicInfo.bio}\n`;
  }

  prompt += `
## 工作经历分析
- 工作经历数量：${workExperienceSummary.totalExperience}段
- 主要公司：${workExperienceSummary.keyCompanies.join(", ") || "无"}
- 主要职位：${workExperienceSummary.keyPositions.join(", ") || "无"}
- 职业发展：${workExperienceSummary.careerProgression}
- 行业背景：${workExperienceSummary.industryBackground.join(", ") || "未明确"}

## 项目经历分析
- 项目数量：${projectExperienceSummary.totalProjects}个
- 核心技术：${projectExperienceSummary.keyTechnologies.join(", ") || "无"}
- 项目类型：${projectExperienceSummary.projectTypes.join(", ") || "无"}
- 技术深度：${projectExperienceSummary.technicalDepth}
${projectExperienceSummary.leadershipRoles.length > 0 ? `- 领导角色：${projectExperienceSummary.leadershipRoles.join(", ")}` : ""}



## 面试指导原则

### 核心约束（必须严格遵守）
**每次回复只能包含一个问题，绝对不允许一次性提出多个问题！**

### 提问策略
1. **单问题原则**：每次只提出一个核心问题，模拟真实面试场景
2. **个性化提问**：基于候选人的具体经历和技能进行针对性提问
3. **渐进式深入**：基于候选人的回答选择最重要的一个方面进行追问
4. **技能验证**：重点验证候选人声称掌握的技能的真实水平
5. **自然对话流**：像真实面试官一样给候选人充分思考时间

### 提问示例
❌ 错误（多问题轰炸）：
"关于你的项目经验，我想了解：1. 项目背景是什么？2. 你的具体职责？3. 遇到什么技术难点？4. 有什么收获？"

✅ 正确（单问题）：
"能详细介绍一下你最有挑战性的那个项目的业务背景吗？"

### 对话节奏
- 提出问题后，等待候选人完整回答
- 基于回答内容，选择一个最值得深入的点进行追问
- 保持专业、友好的态度，给候选人充分表达的机会

记住：真实的面试官不会一次性问很多问题，而是循序渐进地深入了解候选人。`;

  return prompt;
}
