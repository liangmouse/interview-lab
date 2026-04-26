"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ResumeGenerationJob,
  ResumeGenerationSession,
  ResumeGenerationDirectionPreset,
  ResumeVersion,
} from "@interviewclaw/domain";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  getResumeLibrary,
  type ResumeLibraryItem,
} from "@/action/get-resume-library";
import { formatDateTime } from "@/lib/format";
import {
  RESUME_GENERATION_DIRECTION_OPTIONS,
  RESUME_GENERATION_LANGUAGE_OPTIONS,
} from "@/lib/resume-generation";
import {
  createResumeGenerationJob,
  createResumeGenerationSession,
  getResumeGenerationJob,
  listResumeGenerationJobs,
  listResumeVersions,
  submitResumeGenerationAnswer,
} from "@/lib/resume-generation-client";

const RESUME_GENERATION_POLL_INTERVAL_MS = 4000;

function resolveJobStatus(job: ResumeGenerationJob) {
  if (job.status === "succeeded" && job.result) {
    return {
      label: "已完成",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (job.status === "failed") {
    return {
      label: "失败",
      badgeClass: "border-red-200 bg-red-50 text-red-600",
    };
  }

  return {
    label: job.status === "running" ? "生成中" : "排队中",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

function mergeJobs(
  current: ResumeGenerationJob[],
  next: ResumeGenerationJob[],
) {
  if (next.length === 0) {
    return current;
  }

  const nextMap = new Map(next.map((job) => [job.id, job]));
  const merged = current.map((job) => nextMap.get(job.id) ?? job);
  const existingIds = new Set(current.map((job) => job.id));

  for (const job of next) {
    if (!existingIds.has(job.id)) {
      merged.push(job);
    }
  }

  return merged.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export function ResumeGenerationPanel() {
  const [resumeLibrary, setResumeLibrary] = useState<ResumeLibraryItem[]>([]);
  const [versions, setVersions] = useState<ResumeVersion[]>([]);
  const [jobs, setJobs] = useState<ResumeGenerationJob[]>([]);
  const [selectedResumePath, setSelectedResumePath] = useState("");
  const [directionPreset, setDirectionPreset] =
    useState<ResumeGenerationDirectionPreset>("general");
  const [language, setLanguage] = useState<"zh-CN" | "en-US">("zh-CN");
  const [customStylePrompt, setCustomStylePrompt] = useState("");
  const [currentSession, setCurrentSession] =
    useState<ResumeGenerationSession | null>(null);
  const [answerInput, setAnswerInput] = useState("");
  const [activeJob, setActiveJob] = useState<ResumeGenerationJob | null>(null);
  const [jobError, setJobError] = useState("");
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSendingAnswer, setIsSendingAnswer] = useState(false);
  const [isCreatingJob, setIsCreatingJob] = useState(false);

  const pendingJobs = useMemo(
    () =>
      jobs.filter((job) => job.status === "queued" || job.status === "running"),
    [jobs],
  );
  const latestVersion = versions[0] ?? null;
  const sessionStatusLabel = !currentSession
    ? "准备开始"
    : currentSession.sessionStatus === "collecting"
      ? "采集中"
      : "可生成";
  const targetRole = currentSession?.portraitDraft.targetRole ?? "";

  const loadHistory = useCallback(async () => {
    const [loadedVersions, loadedJobs] = await Promise.all([
      listResumeVersions(),
      listResumeGenerationJobs(),
    ]);
    setVersions(loadedVersions);
    setJobs((prev) => mergeJobs(prev, loadedJobs));
    return { loadedVersions, loadedJobs };
  }, []);

  useEffect(() => {
    void Promise.all([getResumeLibrary(), loadHistory()])
      .then(([resumes]) => {
        setResumeLibrary(resumes);
      })
      .catch((error) => {
        console.error("Failed to load resume generation center data:", error);
        setJobError("简历工坊初始化失败，请稍后刷新重试");
      });
  }, [loadHistory]);

  useEffect(() => {
    if (pendingJobs.length === 0) {
      return;
    }

    const timer = window.setInterval(() => {
      void Promise.all(pendingJobs.map((job) => getResumeGenerationJob(job.id)))
        .then((refreshedJobs) => {
          setJobs((prev) => mergeJobs(prev, refreshedJobs));
          const latestActiveJob = refreshedJobs[0] ?? null;
          if (latestActiveJob) {
            setActiveJob(latestActiveJob);
          }

          if (refreshedJobs.some((job) => job.status === "succeeded")) {
            void listResumeVersions().then(setVersions);
          }

          const failedJob = refreshedJobs.find(
            (job) => job.status === "failed",
          );
          if (failedJob) {
            setJobError(failedJob.errorMessage || "简历生成失败，请稍后重试");
          }
        })
        .catch((error) => {
          console.error("Failed to poll resume generation jobs:", error);
        });
    }, RESUME_GENERATION_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [pendingJobs]);

  const handleStartSession = async () => {
    if (!selectedResumePath) {
      setJobError("请先选择一份简历");
      return;
    }

    setIsCreatingSession(true);
    setJobError("");
    setCurrentSession(null);
    setActiveJob(null);

    try {
      const session = await createResumeGenerationSession({
        sourceResumeStoragePath: selectedResumePath,
        directionPreset,
        customStylePrompt: customStylePrompt.trim() || undefined,
        language,
      });
      setCurrentSession(session);
      setAnswerInput("");
    } catch (error) {
      console.error("Failed to create resume generation session:", error);
      setJobError(error instanceof Error ? error.message : "会话创建失败");
    } finally {
      setIsCreatingSession(false);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!currentSession || !answerInput.trim()) {
      return;
    }

    setIsSendingAnswer(true);
    setJobError("");
    try {
      const session = await submitResumeGenerationAnswer({
        sessionId: currentSession.id,
        answer: answerInput.trim(),
      });
      setCurrentSession(session);
      setAnswerInput("");
    } catch (error) {
      console.error("Failed to submit resume generation answer:", error);
      setJobError(error instanceof Error ? error.message : "提交补充信息失败");
    } finally {
      setIsSendingAnswer(false);
    }
  };

  const handleCreateJob = async () => {
    if (!currentSession) {
      return;
    }

    setIsCreatingJob(true);
    setJobError("");
    try {
      const job = await createResumeGenerationJob({
        sessionId: currentSession.id,
      });
      setActiveJob(job);
      setJobs((prev) => mergeJobs(prev, [job]));
      await loadHistory();
    } catch (error) {
      console.error("Failed to create resume generation job:", error);
      setJobError(error instanceof Error ? error.message : "生成任务创建失败");
    } finally {
      setIsCreatingJob(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[calc(100vh-132px)] max-w-4xl flex-col overflow-hidden rounded-[24px] border border-[#DFDDD5] bg-white shadow-[0_24px_70px_rgba(20,20,20,0.08)]">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[#ECE9DF] bg-[#FFFEFA] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#141414] text-white">
            <Bot className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold text-[#141414]">
              AI 简历顾问
            </h2>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{sessionStatusLabel}</span>
              {currentSession ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-[#C9C4B6]" />
                  <span>
                    {currentSession.missingFields.length > 0
                      ? `还缺 ${currentSession.missingFields.length} 项`
                      : "信息齐备"}
                  </span>
                </>
              ) : null}
              {targetRole ? (
                <>
                  <span className="h-1 w-1 rounded-full bg-[#C9C4B6]" />
                  <span className="truncate">{targetRole}</span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {pendingJobs.length > 0 ? (
            <span className="hidden items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 sm:inline-flex">
              <Clock3 className="h-3.5 w-3.5" />
              {pendingJobs.length}
            </span>
          ) : null}
          {latestVersion ? (
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="cursor-pointer"
            >
              <Link href={`/resume-generation/versions/${latestVersion.id}`}>
                预览
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : (
            <span className="hidden items-center gap-1 rounded-full border border-[#E5E0D1] bg-white px-2.5 py-1 text-xs font-medium text-[#7A5C2E] sm:inline-flex">
              <Sparkles className="h-3.5 w-3.5" />
              LapisCV
            </span>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto bg-[#F8F6EF] px-4 py-7 sm:px-8">
        <div className="mx-auto flex max-w-2xl flex-col gap-5">
          {!currentSession ? (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#141414] text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div className="max-w-[min(620px,86%)] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-6 text-[#141414] shadow-sm">
                选好基础简历后直接开始。我只会追问生成简历所必需的信息。
              </div>
            </div>
          ) : currentSession.messages.length > 0 ? (
            currentSession.messages.map((message, index) => {
              const isAssistant = message.role === "assistant";
              return (
                <div
                  key={`${message.createdAt}-${index}`}
                  className={`flex items-start gap-3 ${
                    isAssistant ? "justify-start" : "justify-end"
                  }`}
                >
                  {isAssistant ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#141414] text-white">
                      <Bot className="h-4 w-4" />
                    </div>
                  ) : null}
                  <div
                    className={`max-w-[min(620px,86%)] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                      isAssistant
                        ? "rounded-tl-sm bg-white text-[#141414]"
                        : "rounded-tr-sm bg-[#141414] text-white"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                  {!isAssistant ? (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#E7E2D6] text-[#555]">
                      <UserRound className="h-4 w-4" />
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#141414] text-white">
                <Bot className="h-4 w-4" />
              </div>
              <div className="max-w-[min(620px,86%)] rounded-2xl rounded-tl-sm bg-white px-4 py-3 text-sm leading-6 text-[#141414] shadow-sm">
                信息已经够了，可以开始生成。
              </div>
            </div>
          )}

          {activeJob ? (
            <div className="mx-auto flex max-w-full items-center gap-3 rounded-full border border-[#E4E0D5] bg-white px-3 py-2 text-xs text-[#555] shadow-sm">
              <span
                className={`rounded-full border px-2 py-0.5 font-medium ${resolveJobStatus(activeJob).badgeClass}`}
              >
                {resolveJobStatus(activeJob).label}
              </span>
              <span className="truncate">
                {activeJob.payload.portraitSnapshot.targetRole ||
                  "简历生成任务"}
              </span>
              {activeJob.result?.previewUrl ? (
                <Link
                  href={activeJob.result.previewUrl}
                  className="shrink-0 font-medium text-[#0F6A4B]"
                >
                  查看
                </Link>
              ) : null}
            </div>
          ) : latestVersion ? (
            <div className="mx-auto flex max-w-full items-center gap-3 rounded-full border border-[#E4E0D5] bg-white px-3 py-2 text-xs text-[#555] shadow-sm">
              <FileText className="h-3.5 w-3.5 shrink-0 text-[#777]" />
              <span className="truncate">
                最近版本：{latestVersion.title} ·{" "}
                {formatDateTime(latestVersion.createdAt)}
              </span>
              <Link
                href={`/resume-generation/versions/${latestVersion.id}`}
                className="shrink-0 font-medium text-[#0F6A4B]"
              >
                预览
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <footer className="shrink-0 border-t border-[#ECE9DF] bg-[#FFFEFA] px-4 py-4 sm:px-5">
        {currentSession ? (
          currentSession.sessionStatus === "collecting" ? (
            <div className="space-y-3">
              {currentSession.suggestedAnswerHints.length > 0 ? (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {currentSession.suggestedAnswerHints
                    .slice(0, 3)
                    .map((hint) => (
                      <Badge
                        key={hint}
                        variant="outline"
                        className="shrink-0 bg-white"
                      >
                        {hint}
                      </Badge>
                    ))}
                </div>
              ) : null}
              <div className="flex items-end gap-2">
                <Textarea
                  value={answerInput}
                  onChange={(event) => setAnswerInput(event.target.value)}
                  placeholder="直接回复这个问题..."
                  rows={2}
                  className="min-h-14 resize-none rounded-2xl border-[#DDD8CC] bg-white px-4 py-3 shadow-none"
                />
                <Button
                  onClick={() => void handleSubmitAnswer()}
                  loading={isSendingAnswer}
                  disabled={!answerInput.trim()}
                  size="icon-lg"
                  className="h-12 w-12 shrink-0 cursor-pointer rounded-full bg-[#141414] text-white hover:bg-[#222]"
                  aria-label="提交补充信息"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2 text-sm text-[#124E36]">
                <CheckCircle2 className="h-5 w-5 shrink-0" />
                <span className="truncate">
                  信息齐备，可以生成 Markdown 简历
                </span>
              </div>
              <Button
                onClick={() => void handleCreateJob()}
                loading={isCreatingJob}
                className="cursor-pointer bg-[#0F6A4B] text-white hover:bg-[#0C553C]"
              >
                开始生成
              </Button>
            </div>
          )
        ) : (
          <div className="space-y-3">
            <div className="grid gap-2 lg:grid-cols-[minmax(0,1.35fr)_180px_132px_auto]">
              <label className="sr-only" htmlFor="resume-generation-source">
                选择基础简历
              </label>
              <Select
                value={selectedResumePath}
                onValueChange={setSelectedResumePath}
                disabled={resumeLibrary.length === 0}
              >
                <SelectTrigger
                  id="resume-generation-source"
                  className="h-11 w-full rounded-xl border-[#DDD8CC] bg-white"
                >
                  <SelectValue
                    placeholder={
                      resumeLibrary.length === 0
                        ? "暂无可用简历"
                        : "选择基础简历"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {resumeLibrary.map((resume) => (
                      <SelectItem key={resume.filePath} value={resume.filePath}>
                        {resume.defaultName}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <label className="sr-only" htmlFor="resume-generation-direction">
                投递方向
              </label>
              <Select
                value={directionPreset}
                onValueChange={(value) =>
                  setDirectionPreset(value as ResumeGenerationDirectionPreset)
                }
              >
                <SelectTrigger
                  id="resume-generation-direction"
                  className="h-11 w-full rounded-xl border-[#DDD8CC] bg-white"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {RESUME_GENERATION_DIRECTION_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <label className="sr-only" htmlFor="resume-generation-language">
                输出语言
              </label>
              <Select
                value={language}
                onValueChange={(value) => setLanguage(value as typeof language)}
              >
                <SelectTrigger
                  id="resume-generation-language"
                  className="h-11 w-full rounded-xl border-[#DDD8CC] bg-white"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {RESUME_GENERATION_LANGUAGE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              <Button
                onClick={() => void handleStartSession()}
                loading={isCreatingSession}
                disabled={!selectedResumePath}
                className="h-11 cursor-pointer rounded-xl bg-[#141414] px-5 text-white hover:bg-[#222]"
              >
                开始
              </Button>
            </div>

            <details className="group">
              <summary className="w-fit cursor-pointer list-none text-xs text-muted-foreground transition hover:text-[#141414]">
                高级要求
              </summary>
              <Textarea
                value={customStylePrompt}
                onChange={(event) => setCustomStylePrompt(event.target.value)}
                placeholder="可选：补充语言风格、目标公司偏好、强调项目等。"
                rows={2}
                className="mt-2 min-h-14 resize-none rounded-xl border-[#DDD8CC] bg-white shadow-none"
              />
            </details>
          </div>
        )}

        {jobError ? (
          <p className="mt-3 text-sm text-red-500">{jobError}</p>
        ) : null}
      </footer>
    </div>
  );
}
