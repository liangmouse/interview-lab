/**
 * 关键词提取器
 * 从用户简历中提取专有名词，用于提升 STT 识别准确率
 */

interface Education {
  school?: string;
  major?: string;
  degree?: string;
}

interface Experience {
  company?: string;
  position?: string;
  department?: string;
}

interface UserProfile {
  name?: string;
  education?: Education[];
  experience?: Experience[];
  skills?: string[];
}

/**
 * 从用户资料中提取关键词
 * 主要提取：人名、学校名、公司名、职位、技能等专有名词
 */
export function extractKeywordsFromProfile(
  profile: UserProfile | null | undefined,
): string[] {
  if (!profile) {
    return [];
  }

  const keywords: string[] = [];
  // 1. 提高姓名精度
  if (profile.name && typeof profile.name === "string") {
    keywords.push(profile.name.trim());
  }

  // 2. 提取教育背景 解决清华大学 -> 青花大雪的问题
  if (Array.isArray(profile.education)) {
    profile.education.forEach((edu) => {
      if (edu.school && typeof edu.school === "string") {
        keywords.push(edu.school.trim());
      }
      if (edu.major && typeof edu.major === "string") {
        keywords.push(edu.major.trim());
      }
      if (edu.degree && typeof edu.degree === "string") {
        keywords.push(edu.degree.trim());
      }
    });
  }

  // 3. 提取工作经历（解决"eBay"->"一倍"、"美团"->"美国"的问题）
  if (Array.isArray(profile.experience)) {
    profile.experience.forEach((exp) => {
      if (exp.company && typeof exp.company === "string") {
        keywords.push(exp.company.trim());
      }
      if (exp.position && typeof exp.position === "string") {
        keywords.push(exp.position.trim());
      }
      if (exp.department && typeof exp.department === "string") {
        keywords.push(exp.department.trim());
      }
    });
  }

  // 4. 提取技能关键词
  if (Array.isArray(profile.skills)) {
    profile.skills.forEach((skill) => {
      if (typeof skill === "string" && skill.trim()) {
        keywords.push(skill.trim());
      }
    });
  }

  // 去重并过滤空字符串
  const uniqueKeywords = [...new Set(keywords)].filter(
    (k) => k && k.length > 0,
  );

  return uniqueKeywords;
}
