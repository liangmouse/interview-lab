"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ResumeGenerationJob,
  ResumeGenerationSession,
  ResumeGenerationDirectionPreset,
  ResumeVersion,
} from "@interviewclaw/domain";
import { Link } from "@/i18n/navigation";
import { ArrowRight, FileText, Languages, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  getResumeLibrary,
  type ResumeLibraryItem,
} from "@/action/get-resume-library";
import { formatDateTime } from "@/lib/format";
import {
  RESUME_GENERATION_DIRECTION_OPTIONS,
  RESUME_GENERATION_LANGUAGE_OPTIONS,
  formatResumeGenerationMissingField,
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

  const hasResumeLibrary = resumeLibrary.length > 0;
  const pendingJobs = useMemo(
    () =>
      jobs.filter((job) => job.status === "queued" || job.status === "running"),
    [jobs],
  );

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

  const sessionSummary = useMemo(() => {
    if (!currentSession) {
      return null;
    }

    return {
      targetRole: currentSession.portraitDraft.targetRole,
      summary: currentSession.portraitDraft.summary,
      skills: currentSession.portraitDraft.skills,
      missingFields: currentSession.missingFields.map(
        formatResumeGenerationMissingField,
      ),
    };
  }, [currentSession]);

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
    <div className="space-y-6">
      <Card className="overflow-hidden border-[#E5E5E5] bg-[linear-gradient(135deg,#fffdf7,white_55%,#f7fbf8)]">
        <CardHeader className="border-b border-[#F0ECE2]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <CardTitle className="text-xl text-[#141414]">
                开始一版新简历
              </CardTitle>
              <CardDescription>
                基于已有简历做二次重写，通过分步补问把事实补齐，再生成可预览的
                Markdown 简历。
              </CardDescription>
            </div>
            <div className="rounded-full border border-[#E5E0D1] bg-white/80 px-3 py-1 text-xs font-medium text-[#7A5C2E]">
              LapisCV 风格预览
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-6">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3">
              <label className="text-sm font-medium text-[#141414]">
                选择基础简历
              </label>
              <div className="grid gap-3">
                {hasResumeLibrary ? (
                  resumeLibrary.map((resume) => {
                    const selected = selectedResumePath === resume.filePath;
                    return (
                      <button
                        key={resume.filePath}
                        type="button"
                        onClick={() => setSelectedResumePath(resume.filePath)}
                        className={`rounded-xl border p-4 text-left transition ${
                          selected
                            ? "border-[#0F6A4B] bg-[#F4FBF8] shadow-[0_10px_30px_rgba(15,106,75,0.08)]"
                            : "border-[#E8E5DA] bg-white hover:bg-[#FCFBF8]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-[#141414]">
                              {resume.defaultName}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              上传于 {formatDateTime(resume.uploadedAt)}
                            </p>
                          </div>
                          <FileText className="h-4 w-4 text-[#7A7A7A]" />
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-[#DADADA] bg-[#FCFCFC] px-4 py-8 text-center text-sm text-muted-foreground">
                    暂无可用简历，请先在个人资料里上传 PDF 简历。
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-5 rounded-2xl border border-[#EFE8D8] bg-white/80 p-5">
              <div className="space-y-3">
                <label className="text-sm font-medium text-[#141414]">
                  投递方向预设
                </label>
                <div className="flex flex-wrap gap-2">
                  {RESUME_GENERATION_DIRECTION_OPTIONS.map((option) => {
                    const selected = directionPreset === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setDirectionPreset(option.value)}
                        className={`rounded-full border px-3 py-1.5 text-sm transition ${
                          selected
                            ? "border-[#0F6A4B] bg-[#0F6A4B] text-white"
                            : "border-[#E4DFD4] bg-white text-[#333] hover:border-[#B9C8BD]"
                        }`}
                        title={option.description}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-[#141414]">
                  输出语言
                </label>
                <div className="flex flex-wrap gap-2">
                  {RESUME_GENERATION_LANGUAGE_OPTIONS.map((option) => {
                    const selected = language === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setLanguage(option.value)}
                        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${
                          selected
                            ? "border-[#1B4B91] bg-[#1B4B91] text-white"
                            : "border-[#E4DFD4] bg-white text-[#333]"
                        }`}
                      >
                        <Languages className="h-3.5 w-3.5" />
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-medium text-[#141414]">
                  自定义要求
                </label>
                <Textarea
                  value={customStylePrompt}
                  onChange={(event) => setCustomStylePrompt(event.target.value)}
                  placeholder="例如：更偏英文互联网风格，强调 AI 项目、技术深度和量化结果。"
                  rows={5}
                />
              </div>

              <Button
                onClick={() => void handleStartSession()}
                loading={isCreatingSession}
                disabled={!hasResumeLibrary}
                className="w-full cursor-pointer bg-[#141414] text-white hover:bg-[#222]"
              >
                开始补充采集
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="border-[#E5E5E5] bg-white">
          <CardHeader>
            <CardTitle className="text-xl text-[#141414]">采集对话</CardTitle>
            <CardDescription>
              系统会一次只追问一个最关键的缺失信息，补齐后即可生成。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentSession ? (
              <>
                <div className="space-y-3 rounded-2xl border border-[#EFEFEF] bg-[#FAFAFA] p-4">
                  {currentSession.messages.length > 0 ? (
                    currentSession.messages.map((message, index) => (
                      <div
                        key={`${message.createdAt}-${index}`}
                        className={`rounded-2xl px-4 py-3 ${
                          message.role === "assistant"
                            ? "mr-8 bg-white text-[#141414] shadow-sm"
                            : "ml-8 bg-[#111] text-white"
                        }`}
                      >
                        <p className="text-xs opacity-70">
                          {message.role === "assistant"
                            ? "系统提问"
                            : "你的补充"}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                          {message.content}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      当前信息已经足够，可以直接生成。
                    </p>
                  )}
                </div>

                {currentSession.sessionStatus === "collecting" ? (
                  <div className="space-y-3">
                    <Textarea
                      value={answerInput}
                      onChange={(event) => setAnswerInput(event.target.value)}
                      placeholder="按问题直接补充，尽量给出项目背景、职责、动作和结果。"
                      rows={5}
                    />
                    <div className="flex flex-wrap gap-2">
                      {currentSession.suggestedAnswerHints.map((hint) => (
                        <Badge key={hint} variant="outline">
                          {hint}
                        </Badge>
                      ))}
                    </div>
                    <Button
                      onClick={() => void handleSubmitAnswer()}
                      loading={isSendingAnswer}
                      disabled={!answerInput.trim()}
                      className="cursor-pointer"
                    >
                      提交补充信息
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#DDEFE5] bg-[#F4FBF8] p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-[#124E36]">
                          信息已整理完成
                        </p>
                        <p className="mt-1 text-sm text-[#4B6B5E]">
                          现在可以开始生成 Markdown 简历，并进入预览页导出 PDF。
                        </p>
                      </div>
                      <Button
                        onClick={() => void handleCreateJob()}
                        loading={isCreatingJob}
                        className="cursor-pointer bg-[#0F6A4B] text-white hover:bg-[#0C553C]"
                      >
                        开始生成
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#DADADA] bg-[#FCFCFC] px-6 py-10 text-center">
                <Sparkles className="mx-auto h-5 w-5 text-[#A08A5A]" />
                <p className="mt-3 text-base font-medium text-[#141414]">
                  先创建一个采集会话
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  选择简历、投递方向和语言后，系统会自动判断缺什么再继续追问。
                </p>
              </div>
            )}

            {jobError ? (
              <p className="text-sm text-red-500">{jobError}</p>
            ) : null}
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-[#E5E5E5] bg-white">
            <CardHeader>
              <CardTitle className="text-xl text-[#141414]">
                当前画像摘要
              </CardTitle>
              <CardDescription>这里展示已沉淀出来的关键信息。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {sessionSummary ? (
                <>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#888]">
                      Target
                    </p>
                    <p className="text-sm text-[#141414]">
                      {sessionSummary.targetRole || "待补充"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#888]">
                      Summary
                    </p>
                    <p className="text-sm leading-6 text-[#141414]">
                      {sessionSummary.summary || "待补充"}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#888]">
                      Skills
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sessionSummary.skills.length > 0 ? (
                        sessionSummary.skills.map((skill) => (
                          <Badge key={skill} variant="secondary">
                            {skill}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          待补充
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-[#888]">
                      Missing
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {sessionSummary.missingFields.length > 0 ? (
                        sessionSummary.missingFields.map((field) => (
                          <Badge key={field} variant="outline">
                            {field}
                          </Badge>
                        ))
                      ) : (
                        <Badge className="bg-emerald-600 text-white">
                          已齐备
                        </Badge>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  还没有开始采集，创建会话后这里会实时更新。
                </p>
              )}
            </CardContent>
          </Card>

          <Card className="border-[#E5E5E5] bg-white">
            <CardHeader>
              <CardTitle className="text-xl text-[#141414]">生成记录</CardTitle>
              <CardDescription>
                任务状态与历史版本都会展示在这里。
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeJob ? (
                <div className="rounded-2xl border border-[#ECECEC] bg-[#FCFCFC] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-[#141414]">
                        {activeJob.payload.portraitSnapshot.targetRole ||
                          "简历生成任务"}
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        创建于 {formatDateTime(activeJob.createdAt)}
                      </p>
                      {activeJob.result?.summary ? (
                        <p className="mt-3 text-sm leading-6 text-[#333]">
                          {activeJob.result.summary}
                        </p>
                      ) : null}
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${resolveJobStatus(activeJob).badgeClass}`}
                    >
                      {resolveJobStatus(activeJob).label}
                    </span>
                  </div>
                  {activeJob.result?.previewUrl ? (
                    <Button
                      asChild
                      variant="outline"
                      className="mt-4 cursor-pointer"
                    >
                      <Link href={activeJob.result.previewUrl}>
                        查看预览
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {versions.length > 0 ? (
                versions.map((version) => (
                  <div
                    key={version.id}
                    className="rounded-2xl border border-[#ECECEC] bg-white p-4"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-2">
                        <p className="font-medium text-[#141414]">
                          {version.title}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {version.summary}
                        </p>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          <span>{formatDateTime(version.createdAt)}</span>
                          <span>
                            {version.language === "en-US" ? "英文" : "中文"}
                          </span>
                        </div>
                      </div>
                      <Button
                        asChild
                        variant="ghost"
                        className="cursor-pointer"
                      >
                        <Link
                          href={`/resume-generation/versions/${version.id}`}
                        >
                          预览
                        </Link>
                      </Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[#DADADA] bg-[#FCFCFC] px-6 py-8 text-center text-sm text-muted-foreground">
                  暂无历史版本，生成第一版后会出现在这里。
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
