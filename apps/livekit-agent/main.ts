import { type JobProcess, defineAgent } from "@livekit/agents";
import * as dotenv from "dotenv";
import * as silero from "@livekit/agents-plugin-silero";
import { initAgentsLogger } from "./src/bootstrap/logger";
import { agentEntry } from "./src/runtime/entry";

// Global Error Handlers
process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
});

// Load environment variables
dotenv.config({ path: ".env.local" });
dotenv.config();

// LiveKit Agents logger must be initialized before using plugins
initAgentsLogger();

export default defineAgent({
  // 语音活动监测的VAD模型加载预热
  prewarm: async (proc: JobProcess) => {
    console.log("[Prewarm] Loading VAD model...");
    // 增加 minSilenceDuration 避免连续发言被拆成多段
    proc.userData.vad = await silero.VAD.load({
      minSilenceDuration: 2.0, // 2000ms，至少保留2s时长供用户会话连续
      minSpeechDuration: 0.2, // 200ms，最短语音时长
    });
    console.log("[Prewarm] VAD model loaded successfully");
  },

  entry: agentEntry,
});
