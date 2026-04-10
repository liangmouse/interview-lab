"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Code2,
  List,
  Loader2,
  Play,
  Terminal,
  X,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import { CodeEditor } from "./code-editor";
import {
  buildDefaultCodingInterviewDraftState,
  buildEditorFiles,
  type CodeProblem,
  type CodingInterviewDraftState,
  type CodeTabId,
} from "./code-editor-utils";
import {
  executeCodeRun,
  type OutputLine,
  type RunResult,
} from "./use-code-runner";

type CodingInterviewRoomProps = {
  interviewId: string;
  problems: CodeProblem[];
  initialDraftState?: CodingInterviewDraftState;
};

function difficultyClassName(difficulty: CodeProblem["difficulty"]) {
  if (difficulty === "easy") return "bg-emerald-100 text-emerald-700";
  if (difficulty === "hard") return "bg-rose-100 text-rose-700";
  return "bg-amber-100 text-amber-700";
}

function difficultyLabel(difficulty: CodeProblem["difficulty"]) {
  if (difficulty === "easy") return "简单";
  if (difficulty === "hard") return "困难";
  return "中等";
}

function sourceLabel(sourceKind?: CodeProblem["sourceKind"]) {
  return sourceKind === "resume" ? "岗位/简历相关" : "LeetCode 风格";
}

function OutputLineView({ line }: { line: OutputLine }) {
  const isPass = line.type === "log" && line.text.startsWith("✓");
  const isFail = line.type === "log" && line.text.startsWith("✗");

  return (
    <div
      className={cn(
        "mt-1 whitespace-pre-wrap break-all",
        isPass && "text-[#10B981]",
        isFail && "text-[#F87171]",
        !isPass && !isFail && line.type === "error" && "text-[#F87171]",
        !isPass && !isFail && line.type === "warn" && "text-[#FBBF24]",
        !isPass && !isFail && line.type === "log" && "text-[#AAAAAA]",
        !isPass && !isFail && line.type === "info" && "text-[#60A5FA]",
      )}
    >
      {line.text}
    </div>
  );
}

function ProblemListDrawer({
  open,
  onOpenChange,
  problems,
  activeProblemIndex,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  problems: Array<CodeProblem & { id: string }>;
  activeProblemIndex: number;
  onSelect: (index: number) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        aria-describedby={undefined}
        className="top-0 left-0 h-full w-[min(92vw,420px)] max-w-none translate-x-0 translate-y-0 rounded-none border-r border-[#E5E7EB] bg-white p-0 shadow-2xl"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-4">
            <div>
              <DialogTitle className="text-base font-semibold text-[#0F172A]">
                题目列表
              </DialogTitle>
              <div className="mt-1 text-xs text-[#64748B]">
                选择题目后，左侧详情与右侧代码会同步切换
              </div>
            </div>
            <DialogClose className="rounded-full p-2 text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]">
              <X className="h-4 w-4" />
              <span className="sr-only">关闭题目列表</span>
            </DialogClose>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4">
            <div className="grid gap-3">
              {problems.map((problem, index) => (
                <button
                  key={problem.id}
                  type="button"
                  onClick={() => onSelect(index)}
                  className={cn(
                    "rounded-2xl border px-4 py-3 text-left transition-all",
                    activeProblemIndex === index
                      ? "border-[#0F3E2E] bg-[#F0FDF4] shadow-sm"
                      : "border-[#E5E7EB] bg-white hover:border-[#A7F3D0] hover:bg-[#F8FAFC]",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-[#0F172A]">
                        第 {index + 1} 题
                      </div>
                      <div className="mt-1 truncate text-sm text-[#475569]">
                        {problem.title}
                      </div>
                    </div>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        difficultyClassName(problem.difficulty),
                      )}
                    >
                      {difficultyLabel(problem.difficulty)}
                    </span>
                  </div>
                  <div className="mt-3 text-[11px] text-[#64748B]">
                    {sourceLabel(problem.sourceKind)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function CodingInterviewRoom({
  interviewId,
  problems,
  initialDraftState,
}: CodingInterviewRoomProps) {
  const safeProblems = useMemo(
    () =>
      problems.map((problem, index) => ({
        ...problem,
        id: problem.id || `${interviewId}-problem-${index + 1}`,
      })),
    [interviewId, problems],
  );
  const defaultDraftState = useMemo(
    () => buildDefaultCodingInterviewDraftState(safeProblems),
    [safeProblems],
  );
  const [activeProblemIndex, setActiveProblemIndex] = useState(
    initialDraftState?.activeProblemIndex ??
      defaultDraftState.activeProblemIndex,
  );
  const [activeTab, setActiveTab] = useState<CodeTabId>(
    initialDraftState?.activeTab ?? defaultDraftState.activeTab,
  );
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [runningProblemId, setRunningProblemId] = useState<string | null>(null);
  const [isProblemDrawerOpen, setIsProblemDrawerOpen] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >(initialDraftState ? "saved" : "idle");
  const detailScrollRef = useRef<HTMLDivElement | null>(null);
  const [filesByProblem, setFilesByProblem] = useState<
    Record<string, Record<CodeTabId, string>>
  >(
    () => initialDraftState?.filesByProblem ?? defaultDraftState.filesByProblem,
  );
  const [resultsByProblem, setResultsByProblem] = useState<
    Record<string, RunResult | null>
  >(
    () =>
      initialDraftState?.resultsByProblem ?? defaultDraftState.resultsByProblem,
  );
  const hasHydratedDraftRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!detailScrollRef.current) return;

    if (typeof detailScrollRef.current.scrollTo === "function") {
      detailScrollRef.current.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    detailScrollRef.current.scrollTop = 0;
  }, [activeProblemIndex]);

  useEffect(() => {
    if (!hasHydratedDraftRef.current) {
      hasHydratedDraftRef.current = true;
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        setSaveState("saving");
        const response = await fetch("/api/interview/coding-problems", {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            interviewId,
            draftState: {
              activeProblemIndex,
              activeTab,
              filesByProblem,
              resultsByProblem,
            } satisfies CodingInterviewDraftState,
          }),
        });

        if (!response.ok) {
          throw new Error("保存编码草稿失败");
        }

        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    }, 800);

    return () => window.clearTimeout(timer);
  }, [
    activeProblemIndex,
    activeTab,
    filesByProblem,
    interviewId,
    resultsByProblem,
  ]);

  const activeProblem = safeProblems[activeProblemIndex];
  const activeProblemId = activeProblem?.id;
  const activeFiles =
    (activeProblemId && filesByProblem[activeProblemId]) ||
    buildEditorFiles(activeProblem);
  const activeResult =
    (activeProblemId && resultsByProblem[activeProblemId]) || null;
  const isRunning = runningProblemId === activeProblemId;
  const hasPreviousProblem = activeProblemIndex > 0;
  const hasNextProblem = activeProblemIndex < safeProblems.length - 1;

  const handleSelectProblem = (index: number) => {
    setActiveProblemIndex(index);
  };

  const handleChange = (tab: CodeTabId, value: string) => {
    if (!activeProblemId) return;
    setFilesByProblem((prev) => ({
      ...prev,
      [activeProblemId]: {
        ...(prev[activeProblemId] || buildEditorFiles(activeProblem)),
        [tab]: value,
      },
    }));
  };

  const handleRun = async () => {
    if (!activeProblemId) return;
    setRunningProblemId(activeProblemId);
    const result = await executeCodeRun(activeFiles.solution, activeFiles.test);
    setResultsByProblem((prev) => ({
      ...prev,
      [activeProblemId]: result,
    }));
    setRunningProblemId(null);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  if (safeProblems.length === 0) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-[#F7F7F2] text-sm text-muted-foreground">
        当前没有可用的编码题，请返回重新发起专项面试。
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-[#F7F7F2]">
      <ProblemListDrawer
        open={isProblemDrawerOpen}
        onOpenChange={setIsProblemDrawerOpen}
        problems={safeProblems}
        activeProblemIndex={activeProblemIndex}
        onSelect={handleSelectProblem}
      />

      <header className="flex min-h-14 items-center justify-between gap-4 border-b border-[#E5E7EB] bg-white px-4 py-3 md:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/interview?mode=focus"
            className="rounded-full p-2 text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A]"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-[#0F172A]">
              代码编程专项
            </div>
            <div className="text-xs text-[#64748B]">
              左侧专注读题，右侧编写与运行代码
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 items-center justify-center">
          <div className="flex items-center gap-2 rounded-2xl border border-[#E5E7EB] bg-[#F8FAFC] p-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="打开题目列表"
              onClick={() => setIsProblemDrawerOpen(true)}
              className="h-9 gap-2 rounded-xl px-3 text-[#0F172A] hover:bg-white"
            >
              <List className="h-4 w-4" />
              题目列表
            </Button>

            <div className="hidden h-6 w-px bg-[#E2E8F0] md:block" />

            <div className="hidden min-w-[180px] px-2 md:block">
              <div className="text-xs font-medium text-[#64748B]">
                第 {activeProblemIndex + 1} 题 / 共 {safeProblems.length} 题
              </div>
              <div className="truncate text-sm font-semibold text-[#0F172A]">
                {activeProblem.title}
              </div>
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="上一题"
              onClick={() => setActiveProblemIndex((index) => index - 1)}
              disabled={!hasPreviousProblem}
              className="h-9 w-9 rounded-xl text-[#475569] hover:bg-white disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="下一题"
              onClick={() => setActiveProblemIndex((index) => index + 1)}
              disabled={!hasNextProblem}
              className="h-9 w-9 rounded-xl text-[#475569] hover:bg-white disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden rounded-full border border-[#D1FAE5] bg-[#ECFDF5] px-3 py-1 text-xs font-medium text-[#047857] md:block">
            编码模式
          </div>
          <div className="hidden rounded-full border border-[#E5E7EB] bg-white px-3 py-1 text-xs font-medium text-[#64748B] md:block">
            {saveState === "saving"
              ? "草稿保存中"
              : saveState === "error"
                ? "草稿保存失败"
                : saveState === "saved"
                  ? "草稿已保存"
                  : "自动保存已开启"}
          </div>
          <div className="rounded-full border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-1 text-xs font-medium text-[#334155]">
            已用时 {formatTime(elapsedSeconds)}
          </div>
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-hidden">
        <ResizablePanelGroup direction="horizontal" className="h-full w-full">
          <ResizablePanel
            defaultSize={42}
            minSize={28}
            maxSize={68}
            className="flex min-w-0 flex-col bg-white"
          >
            <div
              ref={detailScrollRef}
              className="min-h-0 flex-1 overflow-y-auto px-6 py-6"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    "rounded-full px-2.5 py-1 text-xs font-semibold",
                    difficultyClassName(activeProblem.difficulty),
                  )}
                >
                  {difficultyLabel(activeProblem.difficulty)}
                </span>
                <span className="rounded-full bg-[#EFF6FF] px-2.5 py-1 text-xs font-medium text-[#2563EB]">
                  {sourceLabel(activeProblem.sourceKind)}
                </span>
              </div>

              <h1 className="mt-4 text-2xl font-semibold leading-tight text-[#0F172A]">
                {activeProblem.title}
              </h1>

              <div className="mt-6 space-y-6">
                <section>
                  <div className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                    <Code2 className="h-4 w-4 text-[#0F3E2E]" />
                    题目描述
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-[#334155]">
                    {activeProblem.description}
                  </p>
                </section>

                {activeProblem.examples && activeProblem.examples.length > 0 ? (
                  <section>
                    <div className="text-sm font-semibold text-[#0F172A]">
                      示例
                    </div>
                    <div className="mt-3 space-y-3">
                      {activeProblem.examples.map((example, index) => (
                        <div
                          key={`${activeProblem.id}-example-${index}`}
                          className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4 text-sm text-[#334155]"
                        >
                          <div className="font-medium text-[#0F172A]">
                            示例 {index + 1}
                          </div>
                          <div className="mt-2 whitespace-pre-wrap">
                            输入：{example.input}
                          </div>
                          <div className="mt-1 whitespace-pre-wrap">
                            输出：{example.output}
                          </div>
                          {example.explanation ? (
                            <div className="mt-1 whitespace-pre-wrap text-[#64748B]">
                              解释：{example.explanation}
                            </div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </section>
                ) : null}

                {activeProblem.constraints &&
                activeProblem.constraints.length > 0 ? (
                  <section>
                    <div className="text-sm font-semibold text-[#0F172A]">
                      约束条件
                    </div>
                    <ul className="mt-3 space-y-2 text-sm text-[#334155]">
                      {activeProblem.constraints.map((constraint) => (
                        <li
                          key={`${activeProblem.id}-${constraint}`}
                          className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
                        >
                          {constraint}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle
            withHandle
            className="bg-[#E5E7EB] after:w-2 hover:bg-[#CBD5E1]"
          />

          <ResizablePanel defaultSize={58} minSize={32} className="min-w-0">
            <ResizablePanelGroup direction="vertical" className="h-full w-full">
              <ResizablePanel defaultSize={68} minSize={35} className="min-h-0">
                <section className="flex h-full min-h-0 flex-1 flex-col bg-[#0B1220]">
                  <div className="flex items-center justify-between border-b border-[#1F2937] bg-[#111827] px-4 py-3">
                    <div>
                      <div className="text-sm font-semibold text-[#F8FAFC]">
                        {activeProblem.title}
                      </div>
                      <div className="mt-1 text-xs text-[#94A3B8]">
                        当前作答：第 {activeProblemIndex + 1} 题 /{" "}
                        {safeProblems.length}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={handleRun}
                      disabled={isRunning}
                      className="h-8 gap-1.5 bg-[#10B981] px-3 text-xs font-medium text-white hover:bg-[#059669] disabled:opacity-60"
                    >
                      {isRunning ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Play className="h-3.5 w-3.5 fill-current" />
                      )}
                      {isRunning ? "运行中..." : "运行代码"}
                    </Button>
                  </div>

                  <div className="min-h-0 flex-1">
                    <CodeEditor
                      files={activeFiles}
                      activeTab={activeTab}
                      language={activeProblem.language}
                      onTabChange={setActiveTab}
                      onChange={handleChange}
                    />
                  </div>
                </section>
              </ResizablePanel>

              <ResizableHandle
                withHandle
                className="bg-[#1F2937] after:h-2 hover:bg-[#334155] [&>div]:border-[#334155] [&>div]:bg-[#0F172A] [&>div]:text-[#CBD5E1]"
              />

              <ResizablePanel defaultSize={32} minSize={18} className="min-h-0">
                <div className="flex h-full min-h-[180px] flex-col bg-[#020617]">
                  <div className="flex items-center gap-2 border-b border-[#1F2937] px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#CBD5E1]">
                    <Terminal className="h-3.5 w-3.5" />
                    运行结果
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto px-4 py-3 font-mono text-xs">
                    {isRunning ? (
                      <div className="flex items-center gap-2 text-[#94A3B8]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        正在执行测试...
                      </div>
                    ) : activeResult ? (
                      <>
                        <div className="text-[#10B981]">$ node test.js</div>
                        {activeResult.lines.map((line, index) => (
                          <OutputLineView
                            key={`${activeProblem.id}-line-${index}`}
                            line={line}
                          />
                        ))}
                        {activeResult.error ? (
                          <div className="mt-1 text-[#F87171]">
                            ✗ Uncaught Error: {activeResult.error}
                          </div>
                        ) : null}
                        <div className="mt-3 text-[#64748B]">
                          本次执行耗时 {activeResult.duration}ms
                        </div>
                      </>
                    ) : (
                      <div className="text-[#64748B]">
                        点击右上角“运行代码”查看当前题目的测试结果。
                      </div>
                    )}
                  </div>
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}
