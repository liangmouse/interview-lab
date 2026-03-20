import type { CodeProblem } from "./code-editor-utils";

export type CodeWorkbenchEvent =
  | { action: "open"; problem: CodeProblem }
  | { action: "close" }
  | null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractProblem(data: Record<string, unknown>): CodeProblem | null {
  const title =
    typeof data.questionTitle === "string" ? data.questionTitle : null;
  const description =
    typeof data.description === "string" ? data.description : null;
  const solutionTemplate =
    typeof data.solutionTemplate === "string" ? data.solutionTemplate : null;
  const testTemplate =
    typeof data.testTemplate === "string" ? data.testTemplate : null;

  if (!title || !description || !solutionTemplate || !testTemplate) return null;

  const rawDifficulty = data.difficulty;
  const difficulty: CodeProblem["difficulty"] =
    rawDifficulty === "easy" ||
    rawDifficulty === "medium" ||
    rawDifficulty === "hard"
      ? rawDifficulty
      : "medium";

  const rawLanguage = data.language;
  const language: CodeProblem["language"] =
    rawLanguage === "typescript" || rawLanguage === "python"
      ? rawLanguage
      : "javascript";

  return {
    title,
    description,
    difficulty,
    language,
    solutionTemplate,
    testTemplate,
  };
}

export function resolveCodeWorkbenchEvent(
  message: Record<string, unknown>,
): CodeWorkbenchEvent {
  const type = typeof message.type === "string" ? message.type : "";
  const name = typeof message.name === "string" ? message.name : "";
  const action = typeof message.action === "string" ? message.action : "";

  if (type === "tool_event" && isRecord(message.data)) {
    const tool = message.data.tool;
    const event = message.data.event;

    if (tool === "code_assessment" && event === "start") {
      const problem = extractProblem(message.data);
      if (problem) return { action: "open", problem };
      return null;
    }

    if (tool === "code_assessment" && event === "end")
      return { action: "close" };
  }

  if (type === "code_assessment_start" || name === "start_code_assessment")
    return null;
  if (type === "code_assessment_end" || name === "end_code_assessment")
    return { action: "close" };
  if (action === "open_code_workbench") return null;
  if (action === "close_code_workbench") return { action: "close" };

  return null;
}
