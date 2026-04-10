"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Code2, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  CodeProblem,
  CodingInterviewDraftState,
} from "./code-editor-utils";
import { CodingInterviewRoom } from "./coding-interview-room";

type LoadState = "loading" | "ready" | "error";

type CodingInterviewResponse = {
  problems: CodeProblem[];
  source: "llm" | "fallback" | "timeout-fallback";
  durationMs: number;
  draftState: CodingInterviewDraftState;
};

type CodingInterviewErrorResponse = {
  error?: string;
  redirectTo?: string;
};

type CodingInterviewSessionProps = {
  interviewId: string;
};

const LOADING_PHASES = [
  "正在分析你的目标岗位与简历背景",
  "正在匹配岗位相关题与 LeetCode 风格题",
  "正在生成题目描述与测试用例",
  "正在装载编码环境",
];

function CodingInterviewPreparingShell({
  phase,
  retryCount,
}: {
  phase: string;
  retryCount: number;
}) {
  return (
    <div className="fixed inset-0 flex flex-col bg-[#F7F7F2]">
      <header className="flex h-14 items-center justify-between border-b border-[#E5E7EB] bg-white px-4 md:px-6">
        <div>
          <div className="text-sm font-semibold text-[#0F172A]">
            代码编程专项
          </div>
          <div className="text-xs text-[#64748B]">
            先进入编码页，再异步准备题目
          </div>
        </div>
        <div className="rounded-full border border-[#DBEAFE] bg-[#EFF6FF] px-3 py-1 text-xs font-medium text-[#1D4ED8]">
          预计 5-10 秒
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[42%] min-w-[360px] flex-col border-r border-[#E5E7EB] bg-white">
          <div className="border-b border-[#E5E7EB] px-5 py-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#64748B]">
              <Sparkles className="h-3.5 w-3.5" />
              正在准备题目
            </div>
            <div className="mt-4 rounded-2xl border border-[#DBEAFE] bg-[#F8FBFF] p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#DBEAFE] text-[#1D4ED8]">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-[#0F172A]">
                    {phase}
                  </div>
                  <div className="mt-1 text-xs text-[#64748B]">
                    {retryCount > 0
                      ? `第 ${retryCount + 1} 次尝试中`
                      : "正在为你生成本场编码面试"}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-2">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={`loading-problem-${index}`}
                  className="rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3"
                >
                  <Skeleton className="h-4 w-16 bg-[#E5E7EB]" />
                  <Skeleton className="mt-3 h-3.5 w-40 bg-[#EEF2F7]" />
                  <Skeleton className="mt-2 h-3 w-20 bg-[#EEF2F7]" />
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 px-6 py-5">
            <Skeleton className="h-6 w-32 bg-[#E5E7EB]" />
            <Skeleton className="mt-4 h-4 w-full bg-[#EEF2F7]" />
            <Skeleton className="mt-2 h-4 w-[92%] bg-[#EEF2F7]" />
            <Skeleton className="mt-2 h-4 w-[85%] bg-[#EEF2F7]" />
            <Skeleton className="mt-8 h-4 w-16 bg-[#E5E7EB]" />
            <Skeleton className="mt-3 h-20 w-full bg-[#EEF2F7]" />
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col bg-[#0B1220]">
          <div className="flex items-center justify-between border-b border-[#1F2937] bg-[#111827] px-4 py-3">
            <div>
              <div className="text-sm font-semibold text-[#F8FAFC]">
                正在准备编码环境
              </div>
              <div className="mt-1 text-xs text-[#94A3B8]">
                进入后即可直接运行测试与写代码
              </div>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-[#1E3A2D] bg-[#0D1F17] px-3 py-1 text-xs text-[#86EFAC]">
              <Code2 className="h-3.5 w-3.5" />
              准备中
            </div>
          </div>

          <div className="flex-1 px-5 py-4">
            <Skeleton className="h-full w-full rounded-2xl bg-[#111827]" />
          </div>
        </section>
      </div>
    </div>
  );
}

function CodingInterviewErrorState({
  error,
  onRetry,
}: {
  error: string;
  onRetry: () => void;
}) {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-[#F7F7F2] px-6">
      <div className="w-full max-w-md rounded-3xl border border-[#FECACA] bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF2F2] text-[#DC2626]">
          <AlertCircle className="h-5 w-5" />
        </div>
        <div className="mt-4 text-lg font-semibold text-[#0F172A]">
          编码题准备失败
        </div>
        <div className="mt-2 text-sm leading-6 text-[#64748B]">{error}</div>
        <Button
          onClick={onRetry}
          className="mt-6 h-11 w-full bg-[#0F3E2E] text-white hover:bg-[#0D3427]"
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          重新加载题目
        </Button>
      </div>
    </div>
  );
}

export function CodingInterviewSession({
  interviewId,
}: CodingInterviewSessionProps) {
  const router = useRouter();
  const [state, setState] = useState<LoadState>("loading");
  const [retryCount, setRetryCount] = useState(0);
  const [phaseIndex, setPhaseIndex] = useState(0);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState<CodeProblem[]>([]);
  const [draftState, setDraftState] =
    useState<CodingInterviewDraftState | null>(null);

  const phase = useMemo(
    () => LOADING_PHASES[Math.min(phaseIndex, LOADING_PHASES.length - 1)],
    [phaseIndex],
  );

  const loadProblems = useCallback(async () => {
    setState("loading");
    setError("");
    setPhaseIndex(0);

    try {
      const response = await fetch("/api/interview/coding-problems", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ interviewId }),
      });

      const payload = (await response.json()) as
        | CodingInterviewResponse
        | CodingInterviewErrorResponse;

      if (
        response.status === 404 ||
        ("redirectTo" in payload && typeof payload.redirectTo === "string")
      ) {
        router.replace(
          "redirectTo" in payload && typeof payload.redirectTo === "string"
            ? payload.redirectTo
            : "/interview",
        );
        return;
      }

      if (!response.ok || !("problems" in payload)) {
        throw new Error(
          "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "加载编码题失败，请稍后重试",
        );
      }

      setProblems(payload.problems);
      setDraftState(payload.draftState);
      setState("ready");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "加载编码题失败，请稍后重试",
      );
      setState("error");
    }
  }, [interviewId, router]);

  useEffect(() => {
    void loadProblems();
  }, [loadProblems]);

  useEffect(() => {
    if (state !== "loading") return;

    const timer = setInterval(() => {
      setPhaseIndex((current) =>
        current >= LOADING_PHASES.length - 1 ? current : current + 1,
      );
    }, 1800);

    return () => clearInterval(timer);
  }, [state]);

  const handleRetry = () => {
    setRetryCount((count) => count + 1);
    void loadProblems();
  };

  if (state === "ready") {
    return (
      <CodingInterviewRoom
        interviewId={interviewId}
        problems={problems}
        initialDraftState={draftState ?? undefined}
      />
    );
  }

  if (state === "error") {
    return <CodingInterviewErrorState error={error} onRetry={handleRetry} />;
  }

  return (
    <CodingInterviewPreparingShell phase={phase} retryCount={retryCount} />
  );
}
