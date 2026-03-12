export type CodeWorkbenchAction = "open" | "close" | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function resolveCodeWorkbenchAction(
  message: Record<string, unknown>,
): CodeWorkbenchAction {
  const type = typeof message.type === "string" ? message.type : "";
  const name = typeof message.name === "string" ? message.name : "";
  const action = typeof message.action === "string" ? message.action : "";

  if (type === "code_assessment_start" || name === "start_code_assessment") {
    return "open";
  }

  if (type === "code_assessment_end" || name === "end_code_assessment") {
    return "close";
  }

  if (type === "tool_event" && isRecord(message.data)) {
    const tool = message.data.tool;
    const event = message.data.event;

    if (tool === "code_assessment" && event === "start") return "open";
    if (tool === "code_assessment" && event === "end") return "close";
  }

  if (action === "open_code_workbench") return "open";
  if (action === "close_code_workbench") return "close";

  return null;
}
