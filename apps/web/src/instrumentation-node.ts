import { initializeLangfuseTelemetry } from "@interviewclaw/ai-runtime/telemetry";

export function registerNodeInstrumentation() {
  return initializeLangfuseTelemetry({
    serviceName: "interviewclaw-web",
    exportMode: "immediate",
  });
}
