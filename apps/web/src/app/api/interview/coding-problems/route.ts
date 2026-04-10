import { NextRequest, NextResponse } from "next/server";
import { codingInterviewDataAccess } from "@interviewclaw/data-access";
import type {
  CodeProblem,
  CodingInterviewDraftState,
} from "@/components/interview/code-editor-utils";
import {
  buildDefaultCodingInterviewDraftState,
  buildEditorFiles,
} from "@/components/interview/code-editor-utils";
import { requireOwnedInterview } from "@/lib/interview-rag-service";
import { getOrGenerateCodingInterviewProblems } from "@/lib/coding-interview-service";
import { parseInterviewType } from "@/lib/interview-session";

type CodingInterviewGenerationSource = "llm" | "fallback" | "timeout-fallback";
const CODING_INTERVIEW_REDIRECT_TARGET = "/interview";

function isCodingPersistenceError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return (
    error.message.includes("coding_interview_sessions") ||
    error.message.includes("coding interview session")
  );
}

function buildCodingInterviewUnavailableResponse(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "编码面试状态不可用，请返回面试页重试";

  return NextResponse.json(
    {
      error: message,
      redirectTo: CODING_INTERVIEW_REDIRECT_TARGET,
    },
    { status: 409 },
  );
}

function normalizeGenerationSource(
  source: string | null | undefined,
): CodingInterviewGenerationSource {
  if (source === "fallback" || source === "timeout-fallback") {
    return source;
  }
  return "llm";
}

function normalizeProblems(
  interviewId: string,
  problems: unknown[],
): Array<CodeProblem & { id: string }> {
  return problems.flatMap((problem, index) => {
    if (!problem || typeof problem !== "object") {
      return [];
    }

    const candidate = problem as CodeProblem;
    if (
      typeof candidate.title !== "string" ||
      typeof candidate.description !== "string" ||
      typeof candidate.solutionTemplate !== "string" ||
      typeof candidate.testTemplate !== "string"
    ) {
      return [];
    }

    return [
      {
        ...candidate,
        id:
          typeof candidate.id === "string" && candidate.id.trim().length > 0
            ? candidate.id
            : `${interviewId}-problem-${index + 1}`,
      },
    ];
  });
}

function normalizeDraftState(
  problems: Array<CodeProblem & { id: string }>,
  rawState: unknown,
): CodingInterviewDraftState {
  const fallback = buildDefaultCodingInterviewDraftState(problems);
  if (!rawState || typeof rawState !== "object") {
    return fallback;
  }

  const state = rawState as Partial<CodingInterviewDraftState>;
  const activeProblemIndex =
    typeof state.activeProblemIndex === "number" &&
    state.activeProblemIndex >= 0 &&
    state.activeProblemIndex < problems.length
      ? state.activeProblemIndex
      : fallback.activeProblemIndex;
  const activeTab =
    state.activeTab === "solution" || state.activeTab === "test"
      ? state.activeTab
      : fallback.activeTab;

  const filesByProblem = { ...fallback.filesByProblem };
  if (state.filesByProblem && typeof state.filesByProblem === "object") {
    for (const problem of problems) {
      const candidate = state.filesByProblem[problem.id];
      if (!candidate || typeof candidate !== "object") continue;
      filesByProblem[problem.id] = {
        solution:
          typeof candidate.solution === "string"
            ? candidate.solution
            : buildEditorFiles(problem).solution,
        test:
          typeof candidate.test === "string"
            ? candidate.test
            : buildEditorFiles(problem).test,
      };
    }
  }

  const resultsByProblem = { ...fallback.resultsByProblem };
  if (state.resultsByProblem && typeof state.resultsByProblem === "object") {
    for (const problem of problems) {
      const candidate = state.resultsByProblem[problem.id];
      if (candidate === null) {
        resultsByProblem[problem.id] = null;
        continue;
      }
      if (!candidate || typeof candidate !== "object") continue;

      const lines = Array.isArray(candidate.lines)
        ? candidate.lines.filter(
            (
              line,
            ): line is {
              type: "log" | "error" | "warn" | "info";
              text: string;
            } =>
              !!line &&
              typeof line === "object" &&
              (line.type === "log" ||
                line.type === "error" ||
                line.type === "warn" ||
                line.type === "info") &&
              typeof line.text === "string",
          )
        : [];

      if (typeof candidate.duration !== "number") continue;
      resultsByProblem[problem.id] = {
        lines,
        duration: candidate.duration,
        error:
          typeof candidate.error === "string" ? candidate.error : undefined,
      };
    }
  }

  return {
    activeProblemIndex,
    activeTab,
    filesByProblem,
    resultsByProblem,
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const interviewId = String(body.interviewId || "");

    if (!interviewId) {
      return NextResponse.json({ error: "缺少 interviewId" }, { status: 400 });
    }

    const { profile, interview } = await requireOwnedInterview(interviewId);
    const parsedType = parseInterviewType(interview.type);

    if (parsedType.variant !== "coding") {
      return NextResponse.json(
        { error: "当前面试不是编码模式" },
        { status: 400 },
      );
    }

    const startedAt = Date.now();
    let persistedSession = null;
    try {
      persistedSession =
        await codingInterviewDataAccess.loadCodingInterviewSession(interviewId);
    } catch (error) {
      if (!isCodingPersistenceError(error)) {
        throw error;
      }

      console.warn(
        "[coding-problems] load persisted session failed, redirect to interview dashboard",
        {
          interviewId,
          message: error instanceof Error ? error.message : String(error),
        },
      );
      return buildCodingInterviewUnavailableResponse(error);
    }

    if (persistedSession) {
      const problems = normalizeProblems(
        interviewId,
        persistedSession.problems,
      );
      if (problems.length > 0) {
        return NextResponse.json({
          problems,
          source: normalizeGenerationSource(persistedSession.generationSource),
          durationMs: Date.now() - startedAt,
          draftState: normalizeDraftState(
            problems,
            persistedSession.draftState,
          ),
        });
      }
    }

    const result = await getOrGenerateCodingInterviewProblems({
      interviewId,
      interview,
      profile,
    });
    const problems = normalizeProblems(interviewId, result.problems);
    const draftState = buildDefaultCodingInterviewDraftState(problems);

    try {
      await codingInterviewDataAccess.upsertCodingInterviewSession({
        interviewId,
        generationSource: result.source,
        problems,
        draftState,
      });
    } catch (error) {
      if (!isCodingPersistenceError(error)) {
        throw error;
      }

      console.warn(
        "[coding-problems] persist generated session failed, redirect to interview dashboard",
        {
          interviewId,
          message: error instanceof Error ? error.message : String(error),
        },
      );
      return buildCodingInterviewUnavailableResponse(error);
    }

    return NextResponse.json({
      problems,
      source: result.source,
      durationMs: Date.now() - startedAt,
      draftState,
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成编码题失败" },
      { status },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const interviewId = String(body.interviewId || "");
    const rawDraftState = body.draftState;

    if (!interviewId) {
      return NextResponse.json({ error: "缺少 interviewId" }, { status: 400 });
    }

    const { interview } = await requireOwnedInterview(interviewId);
    const parsedType = parseInterviewType(interview.type);
    if (parsedType.variant !== "coding") {
      return NextResponse.json(
        { error: "当前面试不是编码模式" },
        { status: 400 },
      );
    }

    const persistedSession =
      await codingInterviewDataAccess.loadCodingInterviewSession(interviewId);
    if (!persistedSession) {
      return NextResponse.json(
        { error: "编码题尚未初始化，请先重新加载页面" },
        { status: 409 },
      );
    }

    const problems = normalizeProblems(interviewId, persistedSession.problems);
    const draftState = normalizeDraftState(problems, rawDraftState);

    await codingInterviewDataAccess.saveCodingInterviewDraftState(
      interviewId,
      draftState,
    );

    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "保存编码面试草稿失败",
      },
      { status },
    );
  }
}
