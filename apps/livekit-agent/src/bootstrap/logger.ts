import { initializeLogger } from "@livekit/agents";

export function initAgentsLogger() {
  // LiveKit Agents 在使用任何插件前需要初始化 logger（包括 worker/job 子进程）
  try {
    initializeLogger({
      pretty: true,
      level: process.env.LOG_LEVEL || "info",
    });
  } catch (e) {
    // 防御：重复初始化或运行环境差异时不阻塞启动
    console.warn("[Agent] initializeLogger skipped:", e);
  }
}
