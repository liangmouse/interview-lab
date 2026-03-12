import { WorkerOptions, cli } from "@livekit/agents";
import { fileURLToPath } from "url";
export function runWorkerMode(agentModuleUrl, opts = {}) {
    var _a;
    cli.runApp(new WorkerOptions({
        agent: fileURLToPath(agentModuleUrl),
        loadThreshold: 0.7,
        numIdleProcesses: (_a = opts.numIdleProcesses) !== null && _a !== void 0 ? _a : 3,
    }));
}
