import { WorkerOptions, cli } from "@livekit/agents";
import { fileURLToPath } from "url";

export interface RunWorkerOptions {
  numIdleProcesses?: number;
}

export function runWorkerMode(
  agentModuleUrl: string,
  opts: RunWorkerOptions = {},
) {
  cli.runApp(
    new WorkerOptions({
      agent: fileURLToPath(agentModuleUrl),
      loadThreshold: 0.7,
      numIdleProcesses: opts.numIdleProcesses ?? 3,
    }),
  );
}
