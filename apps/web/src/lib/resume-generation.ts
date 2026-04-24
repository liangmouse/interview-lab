import type {
  ResumeGenerationDirectionPreset,
  ResumeGenerationLanguage,
  ResumeGenerationMissingField,
} from "@interviewclaw/domain";

export const RESUME_GENERATION_DIRECTION_OPTIONS: Array<{
  value: ResumeGenerationDirectionPreset;
  label: string;
  description: string;
}> = [
  {
    value: "general",
    label: "通用中文",
    description: "适合大多数常规岗位投递，强调信息完整和可读性。",
  },
  {
    value: "english",
    label: "英文简历",
    description: "面向外企、海外岗位或需要英文投递的场景。",
  },
  {
    value: "state-owned",
    label: "央国企",
    description: "更强调稳定、组织协作、荣誉和规范表达。",
  },
  {
    value: "hardcore-tech",
    label: "硬核技术",
    description: "突出技术深度、系统复杂度、性能和工程指标。",
  },
  {
    value: "marketing",
    label: "市场营销",
    description: "强调增长结果、活动操盘、渠道和转化数据。",
  },
  {
    value: "postgraduate",
    label: "考研/学术申请",
    description: "偏学术表达，突出教育、研究、竞赛和成果。",
  },
  {
    value: "civil-service",
    label: "公务员/事业单位",
    description: "更强调规范、履历完整、考试或服务经历。",
  },
  {
    value: "custom",
    label: "自定义",
    description: "由你的自由要求决定最终风格与重点。",
  },
];

export const RESUME_GENERATION_LANGUAGE_OPTIONS: Array<{
  value: ResumeGenerationLanguage;
  label: string;
}> = [
  { value: "zh-CN", label: "中文" },
  { value: "en-US", label: "英文" },
];

const missingFieldLabels: Record<ResumeGenerationMissingField, string> = {
  contact: "联系方式",
  targetRole: "目标岗位",
  summary: "核心优势总结",
  education: "教育背景",
  experience: "代表性经历",
  skills: "技能清单",
};

const directionPresetSet = new Set(
  RESUME_GENERATION_DIRECTION_OPTIONS.map((item) => item.value),
);

const languageSet = new Set(
  RESUME_GENERATION_LANGUAGE_OPTIONS.map((item) => item.value),
);

export function isResumeGenerationDirectionPreset(
  value: string,
): value is ResumeGenerationDirectionPreset {
  return directionPresetSet.has(value as ResumeGenerationDirectionPreset);
}

export function isResumeGenerationLanguage(
  value: string,
): value is ResumeGenerationLanguage {
  return languageSet.has(value as ResumeGenerationLanguage);
}

export function formatResumeGenerationMissingField(
  field: ResumeGenerationMissingField,
) {
  return missingFieldLabels[field];
}
