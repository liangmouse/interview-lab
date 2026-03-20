import type { ResumeReviewResult } from "@/types/resume-review";

export const mockResumeReviewResult: ResumeReviewResult = {
  id: "mock-review-001",
  resumeName: "张三_前端工程师简历.pdf",
  overallScore: 72,
  overallAssessment:
    "整体简历结构清晰，工作经历和教育背景表述较为完整。技能描述部分存在较多通用性描述，缺乏量化指标和具体成果，建议重点优化。项目经历的影响力描述有待加强，需补充具体数据支撑。建议针对目标岗位进行关键词优化，提升 ATS 通过率。",
  createdAt: "2026-03-20 14:30",
  sections: [
    {
      sectionName: "工作经历",
      score: 85,
      strengths: [
        "工作经历时间线完整，无明显空缺期",
        "公司背景描述到位，职级晋升路径清晰",
        "部分经历包含了具体的业务场景描述",
      ],
      weaknesses: [
        "成果描述缺乏量化数据，如性能提升百分比、用户增长数等",
        "技术决策的背景和原因描述不足，体现不出技术判断力",
      ],
      suggestions: [
        {
          original: "负责前端开发工作，优化了页面性能，提升了用户体验。",
          improved:
            "主导前端性能优化专项，通过懒加载、代码分割等手段将核心页面 LCP 从 4.2s 降至 1.8s（提升 57%），MAU 留存率提升 12%。",
          reason:
            "量化成果更具说服力，具体技术手段体现专业深度，业务指标联动展示影响力。",
        },
        {
          original: "参与团队协作，完成多个项目的开发任务。",
          improved:
            "作为核心开发之一，与产品、设计、后端协同推进 3 个业务线项目，累计交付功能模块 18 个，按时率 100%。",
          reason: "明确角色定位，用具体数字替代模糊表述，体现执行力与可靠性。",
        },
      ],
    },
    {
      sectionName: "技能描述",
      score: 65,
      strengths: ["涵盖了主流前端技术栈", "工具链和工程化方向有所涉及"],
      weaknesses: [
        "技能列表过于堆砌，缺乏熟练程度区分",
        "通用技能（如 Git、Jira）占比过高，稀释了核心竞争力",
        "缺少对深度掌握方向的具体说明",
      ],
      suggestions: [
        {
          original:
            "熟悉 React、Vue、Angular、HTML、CSS、JavaScript、TypeScript、Node.js、Git、Jira、Figma。",
          improved:
            "精通 React 18 + TypeScript（含 Hooks、并发特性、性能优化）；熟悉 Vue 3 Composition API；了解 Node.js/Express 服务端开发；工程化：Vite、Webpack、pnpm Monorepo。",
          reason:
            "按熟练度分层展示，突出核心优势，删除非差异化工具，让技能栈更聚焦。",
        },
      ],
    },
    {
      sectionName: "项目经历",
      score: 70,
      strengths: [
        "项目背景描述较清晰，能看出业务价值",
        "个人承担的模块有所说明",
      ],
      weaknesses: [
        "项目规模和复杂度体现不足，难以判断技术挑战",
        "技术选型的理由未说明，缺乏主动决策感",
      ],
      suggestions: [
        {
          original:
            "开发了一个管理后台系统，实现了用户管理、权限控制、数据可视化等功能。",
          improved:
            "从零构建企业级管理后台（React 18 + Ant Design Pro），支持 10 万级用户 RBAC 权限体系，集成 ECharts 实现 20+ 维度数据看板，系统上线后运营效率提升 40%。",
          reason:
            "补充规模数据（用户量）、技术栈细节、功能深度，并以业务结果收尾，大幅提升项目含金量感知。",
        },
      ],
    },
    {
      sectionName: "教育背景",
      score: 88,
      strengths: [
        "学历信息完整，院校、专业、时间均清晰",
        "GPA 和相关荣誉有所提及",
        "专业与目标岗位相关性强",
      ],
      weaknesses: ["缺少在校期间的技术实践或竞赛经历"],
      suggestions: [
        {
          original: "计算机科学与技术，本科，2018-2022。",
          improved:
            "计算机科学与技术，本科，2018-2022，GPA 3.7/4.0（专业前 15%）；主修：数据结构、操作系统、计算机网络；曾获校级程序设计大赛二等奖。",
          reason:
            "补充 GPA 排名增加竞争力参考，核心课程体现专业基础，竞赛经历展示主动实践意愿。",
        },
      ],
    },
  ],
  atsCompatibility: {
    score: 80,
    issues: [
      "简历中存在表格或多栏布局，部分 ATS 系统可能解析失败",
      "使用了自定义字体，在纯文本提取时可能丢失格式",
      "联系方式未使用标准字段标注（如 Email:、Phone:）",
    ],
    recommendations: [
      "使用单栏纯文本布局，避免表格和分栏",
      "统一使用系统默认字体（Arial、Times New Roman 等）",
      "在联系信息前添加字段标签，方便系统自动提取",
      "确保关键词与目标 JD 保持一致，提升语义匹配率",
    ],
  },
  jdMatchAnalysis: {
    matchScore: 68,
    matchedKeywords: [
      "React",
      "TypeScript",
      "性能优化",
      "前端工程化",
      "团队协作",
      "Webpack",
    ],
    missingKeywords: [
      "微前端",
      "SSR / Next.js",
      "CI/CD",
      "单元测试",
      "GraphQL",
      "跨端开发",
    ],
    recommendations: [
      "在工作经历中补充与微前端架构相关的实践经历（如 qiankun、Module Federation）",
      "如有 SSR 经验，在项目经历中明确提及 Next.js 或 Nuxt.js",
      "补充单元测试与集成测试相关经历（Jest、Vitest、Cypress 等）",
      "如参与过 CI/CD 流程建设，在工程化技能中显式说明",
    ],
  },
};
