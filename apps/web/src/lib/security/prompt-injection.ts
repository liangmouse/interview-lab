/**
 * 提示词注入防护工具
 */

/**
 * 核心注入模式
 */
const CRITICAL_INJECTION_PATTERNS = [
  // 直接指令覆盖
  /(?:ignore|forget|disregard)\s+(?:previous|all|above)\s+(?:instructions|prompts|rules)/i,
  /(?:忘记|忽略|删除|清除)\s*(?:之前|以上|所有).*?(?:指令|规则|提示)/i,

  // 角色劫持
  /(?:you are now|now you are|act as|pretend to be)\s+(?:admin|system|root)/i,
  /(?:你现在是|你现在扮演|你现在作为)\s*(?:管理员|系统|root)/i,

  // 系统指令注入
  /(?:system|assistant):\s*(?:ignore|forget|你现在是)/i,

  // 尝试泄露系统提示
  /(?:show|display|reveal|output)\s+(?:your|the|system)\s+(?:prompt|instruction|rule)/i,
  /(?:显示|输出|告诉我).*?(?:系统|你的).*?(?:提示词|指令)/i,
];

/**
 * 检测是否有提示词注入尝试
 */
export function detectInjectionAttempt(input: string): {
  isInjection: boolean;
  matchedPattern?: string;
  severity: "low" | "medium" | "high";
} {
  if (!input || typeof input !== "string") {
    return { isInjection: false, severity: "low" };
  }

  const normalizedInput = input.trim().toLowerCase();

  // 检查长度异常
  if (normalizedInput.length > 10000) {
    return {
      isInjection: true,
      matchedPattern: "异常长度",
      severity: "medium",
    };
  }

  // 检查关键注入模式
  for (const pattern of CRITICAL_INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        isInjection: true,
        matchedPattern: pattern.source.substring(0, 50) + "...",
        severity: "high",
      };
    }
  }

  return { isInjection: false, severity: "low" };
}

/**
 * 清理用户输入
 */
export function sanitizeUserInput(
  input: string,
  options: {
    maxLength?: number;
    removeNewlines?: boolean;
    allowMarkdown?: boolean;
  } = {},
): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  const {
    maxLength = 5000,
    removeNewlines = false,
    allowMarkdown = true,
  } = options;

  let sanitized = input.trim();

  // 限制长度
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  // 移除明显的注入尝试关键词
  const dangerousKeywords = [
    /ignore\s+previous\s+instructions/gi,
    /forget\s+all\s+instructions/gi,
    /忘记所有指令/gi,
    /忽略之前的指令/gi,
  ];

  for (const keyword of dangerousKeywords) {
    sanitized = sanitized.replace(keyword, "[filtered]");
  }

  // 移除多余的空格
  sanitized = sanitized.replace(/\s+/g, " ");

  if (removeNewlines) {
    sanitized = sanitized.replace(/\n/g, " ");
  }

  // 如果不允许 Markdown，转义常见 Markdown 特殊字符
  if (!allowMarkdown) {
    sanitized = sanitized
      .replace(/#/g, "\\#")
      .replace(/\*/g, "\\*")
      .replace(/_/g, "\\_")
      .replace(/\[/g, "\\[")
      .replace(/\]/g, "\\]")
      .replace(/\(/g, "\\(")
      .replace(/\)/g, "\\)")
      .replace(/`/g, "\\`");
  }

  return sanitized.trim();
}

/**
 * 转义提示词内容，防止注入
 * 用于将用户数据安全地插入到提示词模板中
 */
export function escapePromptContent(content: string): string {
  if (!content || typeof content !== "string") {
    return "";
  }

  // HTML 转义
  let escaped = content
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");

  // 移除可能的指令分隔符
  escaped = escaped.replace(/\n{3,}/g, "\n\n"); // 限制连续换行

  return escaped;
}

/**
 * 清理用户消息内容
 */
export function sanitizeMessageContent(content: string): string {
  if (!content || typeof content !== "string") {
    return "";
  }

  // 检测注入尝试
  const detection = detectInjectionAttempt(content);

  if (detection.isInjection && detection.severity === "high") {
    // 记录高风险注入尝试
    console.warn("[安全警告] 检测到高风险注入尝试:", {
      pattern: detection.matchedPattern,
      content: content.substring(0, 100),
    });

    // 严格清理
    return sanitizeUserInput(content, {
      maxLength: 2000,
      removeNewlines: true,
    });
  }

  // 正常清理
  return sanitizeUserInput(content, {
    maxLength: 5000,
    removeNewlines: false,
  });
}

/**
 * 清理用于 RAG 查询的文本
 */
export function sanitizeRAGQuery(query: string): string {
  if (!query || typeof query !== "string") {
    return "";
  }

  // RAG 查询需要更严格的清理，因为会被用于向量检索
  let sanitized = sanitizeUserInput(query, {
    maxLength: 500,
    removeNewlines: true,
    allowMarkdown: false,
  });

  // 移除可能的 SQL 注入模式（虽然我们用的是向量检索，但防范未然）
  sanitized = sanitized.replace(/[;'"]/g, "");

  return sanitized.trim();
}

/**
 * 清理用户资料数据（简历、工作经历等）
 */
export function sanitizeProfileData(data: string): string {
  if (!data || typeof data !== "string") {
    return "";
  }

  // 对用户资料数据，我们需要更保守的清理
  // 保留更多内容，但移除明显的注入模式
  let sanitized = data.trim();

  // 限制长度
  if (sanitized.length > 10000) {
    sanitized = sanitized.substring(0, 10000);
  }

  // 移除明显的注入指令
  const highSeverityPatterns = [
    /(?:忽略|忘记|删除|清除).*?(?:所有|全部|指令|规则)/gi,
    /(?:你现在是|你现在扮演).*?(?:系统|管理员)/gi,
  ];

  for (const pattern of highSeverityPatterns) {
    sanitized = sanitized.replace(pattern, "");
  }

  // 转义特殊字符，但保留格式
  sanitized = escapePromptContent(sanitized);

  return sanitized.trim();
}

/**
 * 验证输入是否安全
 */
export function validateInputSafety(input: string): {
  isSafe: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];
  const detection = detectInjectionAttempt(input);

  if (detection.isInjection) {
    warnings.push(`检测到潜在的注入尝试 (严重程度: ${detection.severity})`);
  }

  if (input.length > 5000) {
    warnings.push("输入长度超过建议限制");
  }

  return {
    isSafe: !detection.isInjection || detection.severity === "low",
    warnings,
  };
}
