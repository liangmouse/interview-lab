/**
 * 简历解析日志工具
 * 用于调试简历上传和解析流程
 */

type LogLevel = "info" | "warn" | "error" | "debug";

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  stage: string;
  message: string;
  data?: any;
}

class ResumeParsingLogger {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 100;

  /**
   * 记录日志
   */
  private log(level: LogLevel, stage: string, message: string, data?: any) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      stage,
      message,
      data,
    };

    this.logs.push(entry);

    // 保持日志数量在限制内
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }

    // 在控制台输出
    const emoji = this.getEmoji(level);
    const prefix = `${emoji} [简历解析-${stage}]`;

    switch (level) {
      case "error":
        console.error(prefix, message, data || "");
        break;
      case "warn":
        console.warn(prefix, message, data || "");
        break;
      case "debug":
        console.debug(prefix, message, data || "");
        break;
      default:
        console.log(prefix, message, data || "");
    }
  }

  /**
   * 获取日志级别对应的 emoji
   */
  private getEmoji(level: LogLevel): string {
    const emojiMap: Record<LogLevel, string> = {
      info: "ℹ️",
      warn: "⚠️",
      error: "❌",
      debug: "🔍",
    };
    return emojiMap[level] || "📝";
  }

  /**
   * Info 级别日志
   */
  info(stage: string, message: string, data?: any) {
    this.log("info", stage, message, data);
  }

  /**
   * Warn 级别日志
   */
  warn(stage: string, message: string, data?: any) {
    this.log("warn", stage, message, data);
  }

  /**
   * Error 级别日志
   */
  error(stage: string, message: string, data?: any) {
    this.log("error", stage, message, data);
  }

  /**
   * Debug 级别日志
   */
  debug(stage: string, message: string, data?: any) {
    this.log("debug", stage, message, data);
  }

  /**
   * 获取所有日志
   */
  getLogs(): LogEntry[] {
    return [...this.logs];
  }

  /**
   * 获取特定阶段的日志
   */
  getLogsByStage(stage: string): LogEntry[] {
    return this.logs.filter((log) => log.stage === stage);
  }

  /**
   * 清空日志
   */
  clear() {
    this.logs = [];
  }

  /**
   * 导出日志为 JSON 字符串（用于调试）
   */
  export(): string {
    return JSON.stringify(this.logs, null, 2);
  }
}

// 导出单例实例
export const resumeLogger = new ResumeParsingLogger();

// 导出工具函数
export const logResumeStage = {
  /**
   * PDF 解析阶段
   */
  pdfParsing: (message: string, data?: any) =>
    resumeLogger.info("PDF解析", message, data),

  /**
   * AI 分析阶段
   */
  aiAnalysis: (message: string, data?: any) =>
    resumeLogger.info("AI分析", message, data),

  /**
   * 数据映射阶段
   */
  dataMapping: (message: string, data?: any) =>
    resumeLogger.info("数据映射", message, data),

  /**
   * 数据库更新阶段
   */
  dbUpdate: (message: string, data?: any) =>
    resumeLogger.info("数据库更新", message, data),

  /**
   * 向量化阶段
   */
  vectorization: (message: string, data?: any) =>
    resumeLogger.info("向量化", message, data),

  /**
   * 错误记录
   */
  error: (stage: string, message: string, error: any) =>
    resumeLogger.error(stage, message, {
      message: error?.message,
      stack: error?.stack,
      ...error,
    }),
};
