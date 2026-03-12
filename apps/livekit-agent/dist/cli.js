/**
 * 1. 加载环境变量
 * 2. 初始化 LiveKit Agents logger
 * 3. 检查是否是 fixed room 直连模式
 * 4. 设置 numIdleProcesses，杀死
 * 5. 运行 agent worker
 */
import * as dotenv from "dotenv";
import "@livekit/agents-plugin-deepgram";
import "@livekit/agents-plugin-livekit";
import "@livekit/agents-plugin-silero";
import { initAgentsLogger } from "./src/bootstrap/logger";
import { runWorkerMode } from "./src/modes/worker";
// Load environment variables for CLI mode
dotenv.config({ path: ".env.local" });
dotenv.config();
// LiveKit Agents logger must be initialized before using plugins
initAgentsLogger();
const isFixedRoomMode = process.env.FIXED_ROOM_MODE === "true";
const devRoomName = process.env.DEV_ROOM_NAME;
const shutdown = () => {
    console.log("\n[Agent] Process exiting...");
    process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
// Parse command line arguments
const args = process.argv.slice(2);
// 直连模式的命令强制转换
// 如
if (isFixedRoomMode && devRoomName) {
    // If the command is 'dev' or missing, we swap it for 'connect --room <name>'
    if (args.length === 0 || args[0] === "dev") {
        process.argv = [
            process.argv[0],
            process.argv[1],
            "connect",
            "--room",
            devRoomName,
        ];
        console.log(`[FixedRoomMode] 🔄 Auto-switched to: connect --room ${devRoomName}`);
    }
}
const agentModuleUrl = new URL("./main.ts", import.meta.url).toString();
// 始终使用 runWorkerMode，它在内部调用 cli.runApp()
// 在固定房间模式下，我们将 numIdleProcesses 设置为 0，以避免孤儿进程和冲突
runWorkerMode(agentModuleUrl, {
    numIdleProcesses: isFixedRoomMode ? 0 : 3,
});
