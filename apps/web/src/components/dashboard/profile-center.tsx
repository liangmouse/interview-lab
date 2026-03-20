"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone, type FileRejection } from "react-dropzone";
import {
  Check,
  ChevronRight,
  FileText,
  Loader2,
  PencilLine,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { uploadResume } from "@/action/upload-resume";
import { deleteResume } from "@/action/delete-resume";
import {
  getResumeLibrary,
  type ResumeLibraryItem,
} from "@/action/get-resume-library";
import {
  getProfileInterviews,
  type ProfileInterviewRecord,
} from "@/action/get-profile-interviews";
import { questioningReportHistory } from "@/lib/questioning-center";
import { RADAR_DIMENSIONS, toRadarPolygonPoints } from "@/lib/interview-radar";
import { useUserStore } from "@/store/user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  triggerResumeProcessing,
  waitForProcessedProfile,
} from "@/lib/resume-processing-client";

const ALIAS_STORAGE_KEY = "profile_resume_aliases_v1";

type ResumeAliasMap = Record<string, string>;

interface ResumeReportItem {
  id: string;
  title: string;
  createdAt: string;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatStatus(
  status: string,
  completedLabel: string,
  pendingLabel: string,
) {
  if (status === "completed") {
    return {
      label: completedLabel,
      badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-100",
    };
  }
  return {
    label: pendingLabel,
    badgeClass: "bg-amber-50 text-amber-700 border-amber-100",
  };
}

function RadarMini({
  scores,
}: {
  scores: ProfileInterviewRecord["radarScores"];
}) {
  const size = 120;
  const padding = 16;
  const values = RADAR_DIMENSIONS.map((dimension) => scores[dimension.key]);
  const levels = [20, 40, 60, 80, 100];
  const center = size / 2;
  const radius = size / 2 - padding;

  const polygonPoints = toRadarPolygonPoints(values, size, padding);
  const levelPolygons = levels.map((level) =>
    toRadarPolygonPoints(
      Array(RADAR_DIMENSIONS.length).fill(level),
      size,
      padding,
    ),
  );
  const axisLines = RADAR_DIMENSIONS.map((_, index) => {
    const angle = (Math.PI * 2 * index) / RADAR_DIMENSIONS.length - Math.PI / 2;
    const x2 = center + Math.cos(angle) * radius;
    const y2 = center + Math.sin(angle) * radius;
    return { x2, y2 };
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {levelPolygons.map((points) => (
        <polygon
          key={points}
          points={points}
          fill="none"
          stroke="#E7E7E7"
          strokeWidth="1"
        />
      ))}
      {axisLines.map((line) => (
        <line
          key={`${line.x2}-${line.y2}`}
          x1={center}
          y1={center}
          x2={line.x2}
          y2={line.y2}
          stroke="#EEEEEE"
          strokeWidth="1"
        />
      ))}
      <polygon
        points={polygonPoints}
        fill="rgba(16, 185, 129, 0.18)"
        stroke="#10B981"
        strokeWidth="2"
      />
    </svg>
  );
}

export function ProfileCenter() {
  const t = useTranslations("profile.center");
  const tTable = useTranslations("dashboard.table");
  const { setUserInfo } = useUserStore();

  const [resumes, setResumes] = useState<ResumeLibraryItem[]>([]);
  const [interviews, setInterviews] = useState<ProfileInterviewRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isResumeProcessing, setIsResumeProcessing] = useState(false);

  const [aliases, setAliases] = useState<ResumeAliasMap>({});
  const [isAliasHydrated, setIsAliasHydrated] = useState(false);
  const [editingResumePath, setEditingResumePath] = useState<string | null>(
    null,
  );
  const [editingName, setEditingName] = useState("");
  const [showAllInterviews, setShowAllInterviews] = useState(false);
  const [deletingResumePath, setDeletingResumePath] = useState<string | null>(
    null,
  );
  const [confirmDeletePath, setConfirmDeletePath] = useState<string | null>(
    null,
  );

  const defaultVisibleCount = 4;

  const loadProfileData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [resumeLibrary, interviewHistory] = await Promise.all([
        getResumeLibrary(),
        getProfileInterviews(),
      ]);
      setResumes(resumeLibrary);
      setInterviews(interviewHistory);
    } catch (error) {
      console.error("Failed to load profile center data:", error);
      toast.error(t("loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const raw = window.localStorage.getItem(ALIAS_STORAGE_KEY);
    if (!raw) {
      setIsAliasHydrated(true);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as ResumeAliasMap;
      setAliases(parsed);
    } catch (error) {
      console.warn("Failed to parse local resume aliases:", error);
    } finally {
      setIsAliasHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isAliasHydrated) {
      return;
    }
    window.localStorage.setItem(ALIAS_STORAGE_KEY, JSON.stringify(aliases));
  }, [aliases, isAliasHydrated]);

  useEffect(() => {
    void loadProfileData();
  }, [loadProfileData]);

  const handleDropRejected = useCallback(
    (rejections: FileRejection[]) => {
      const first = rejections[0]?.errors[0];
      if (!first) {
        return;
      }
      if (first.code === "file-too-large") {
        toast.error(t("resumeLibrary.fileTooLarge"));
        return;
      }
      if (first.code === "file-invalid-type") {
        toast.error(t("resumeLibrary.invalidFileType"));
        return;
      }
      toast.error(t("resumeLibrary.uploadFailed"));
    },
    [t],
  );

  const handleDropAccepted = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) {
        return;
      }

      setIsUploadingResume(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const result = await uploadResume(formData);
        if (!result.success || !result.data) {
          toast.error(result.error || t("resumeLibrary.uploadFailed"));
          return;
        }
        setUserInfo(result.data);
        toast.success("简历上传成功，正在后台解析");
        await loadProfileData();

        if (result.storagePath) {
          setIsResumeProcessing(true);
          void triggerResumeProcessing({
            storagePath: result.storagePath,
          })
            .then(() =>
              waitForProcessedProfile({
                baselineUpdatedAt: result.data?.updated_at,
              }),
            )
            .then(async (profile) => {
              if (!profile) {
                return;
              }
              setUserInfo(profile);
              toast.success("简历解析完成，资料已更新");
              await loadProfileData();
            })
            .catch((error) => {
              console.error("Failed to process resume in background:", error);
              toast.error("简历已上传，但后台解析失败，请稍后重试");
            })
            .finally(() => {
              setIsResumeProcessing(false);
            });
        }
      } catch (error) {
        console.error("Failed to upload resume in profile center:", error);
        toast.error(t("resumeLibrary.uploadFailed"));
      } finally {
        setIsUploadingResume(false);
      }
    },
    [loadProfileData, setUserInfo, t],
  );

  const { getInputProps, open } = useDropzone({
    accept: {
      "application/pdf": [".pdf"],
    },
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    noClick: true,
    noKeyboard: true,
    onDropAccepted: handleDropAccepted,
    onDropRejected: handleDropRejected,
    disabled: isUploadingResume || isResumeProcessing,
  });

  const resumeReportItems = useMemo<ResumeReportItem[]>(() => {
    return resumes.slice(0, 3).map((resume) => ({
      id: resume.id,
      title: aliases[resume.filePath] || resume.defaultName,
      createdAt: formatDateTime(resume.uploadedAt),
    }));
  }, [aliases, resumes]);

  const visibleInterviews = useMemo(() => {
    if (showAllInterviews) {
      return interviews;
    }
    return interviews.slice(0, defaultVisibleCount);
  }, [interviews, showAllInterviews]);

  const handleDeleteResume = useCallback(
    async (filePath: string) => {
      setDeletingResumePath(filePath);
      try {
        const result = await deleteResume(filePath);
        if (!result.success) {
          toast.error(result.error || t("resumeLibrary.deleteFailed"));
          return;
        }

        setAliases((prev) => {
          const next = { ...prev };
          delete next[filePath];
          return next;
        });
        toast.success(t("resumeLibrary.deleteSuccess"));
        await loadProfileData();
      } catch (error) {
        console.error("Failed to delete resume:", error);
        toast.error(t("resumeLibrary.deleteFailed"));
      } finally {
        setDeletingResumePath(null);
        setConfirmDeletePath(null);
      }
    },
    [loadProfileData, t],
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Card className="border-[#E5E5E5] bg-white shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-[#666666]">{t("stats.resumeCount")}</p>
            <p className="mt-1 text-2xl font-semibold text-[#141414]">
              {resumes.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E5E5] bg-white shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-[#666666]">
              {t("stats.interviewCount")}
            </p>
            <p className="mt-1 text-2xl font-semibold text-[#141414]">
              {interviews.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E5E5] bg-white shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-[#666666]">{t("stats.resumeReports")}</p>
            <p className="mt-1 text-2xl font-semibold text-[#141414]">
              {resumeReportItems.length}
            </p>
          </CardContent>
        </Card>
        <Card className="border-[#E5E5E5] bg-white shadow-sm">
          <CardContent className="p-4">
            <p className="text-xs text-[#666666]">
              {t("stats.questioningReports")}
            </p>
            <p className="mt-1 text-2xl font-semibold text-[#141414]">
              {questioningReportHistory.length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="relative border-[#E5E5E5] bg-white shadow-sm">
        <CardHeader className="pb-3 pr-36">
          <CardTitle className="text-base font-semibold text-[#141414]">
            {t("resumeLibrary.title")}
          </CardTitle>
        </CardHeader>
        <div className="absolute right-6 top-6">
          <Button
            size="sm"
            className="bg-[#0F3E2E] text-white hover:bg-[#0F3E2E]/90"
            onClick={open}
            disabled={isUploadingResume || isResumeProcessing}
          >
            {isUploadingResume ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Upload className="mr-1.5 h-3.5 w-3.5" />
            )}
            {isResumeProcessing ? "解析中..." : t("resumeLibrary.uploadButton")}
          </Button>
        </div>
        <CardContent>
          <input {...getInputProps()} />

          <div className="space-y-2">
            {isLoading ? (
              [1, 2, 3].map((item) => (
                <Skeleton key={item} className="h-14 w-full" />
              ))
            ) : resumes.length === 0 ? (
              <p className="rounded-lg border border-[#EFEFEF] bg-[#FCFCFC] px-4 py-5 text-sm text-[#777777]">
                {t("resumeLibrary.empty")}
              </p>
            ) : (
              resumes.map((resume) => {
                const displayName =
                  aliases[resume.filePath] || resume.defaultName;
                const isEditing = editingResumePath === resume.filePath;

                return (
                  <div
                    key={resume.id}
                    className="flex items-center justify-between rounded-lg border border-[#EFEFEF] px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      {isEditing ? (
                        <div className="flex items-center gap-1.5">
                          <Input
                            value={editingName}
                            onChange={(event) =>
                              setEditingName(event.target.value)
                            }
                            className="h-8 border-[#E5E5E5] text-sm"
                            maxLength={50}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-emerald-700 hover:bg-emerald-50"
                            onClick={() => {
                              const trimmed = editingName.trim();
                              if (!trimmed) {
                                toast.error(t("resumeLibrary.nameRequired"));
                                return;
                              }
                              setAliases((prev) => ({
                                ...prev,
                                [resume.filePath]: trimmed,
                              }));
                              setEditingResumePath(null);
                              setEditingName("");
                            }}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-[#666666] hover:bg-red-50 hover:text-red-600"
                            onClick={() => {
                              setEditingResumePath(null);
                              setEditingName("");
                            }}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-[#0F3E2E]" />
                          <p className="truncate text-sm font-medium text-[#141414]">
                            {displayName}
                          </p>
                        </div>
                      )}
                      <p className="mt-1 text-xs text-[#777777]">
                        {t("resumeLibrary.savedAt")}:{" "}
                        {formatDateTime(resume.uploadedAt)}
                      </p>
                    </div>
                    {!isEditing && (
                      <div className="ml-3 flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-[#666666]"
                          onClick={() => {
                            setEditingResumePath(resume.filePath);
                            setEditingName(displayName);
                          }}
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-[#666666] hover:bg-red-50 hover:text-red-600"
                          onClick={() => setConfirmDeletePath(resume.filePath)}
                          disabled={deletingResumePath === resume.filePath}
                        >
                          {deletingResumePath === resume.filePath ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          asChild
                          size="sm"
                          variant="outline"
                          className="h-8"
                        >
                          <a
                            href={resume.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {t("resumeLibrary.open")}
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-[#E5E5E5] bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold text-[#141414]">
            {t("interviewHistory.title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading ? (
            [1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-32 w-full" />
            ))
          ) : interviews.length === 0 ? (
            <p className="rounded-lg border border-[#EFEFEF] bg-[#FCFCFC] px-4 py-5 text-sm text-[#777777]">
              {t("interviewHistory.empty")}
            </p>
          ) : (
            visibleInterviews.map((interview) => {
              const statusMeta = formatStatus(
                interview.status,
                tTable("completed"),
                tTable("pending"),
              );
              return (
                <div
                  key={interview.id}
                  className="grid gap-3 rounded-lg border border-[#EFEFEF] p-3 md:grid-cols-[1fr_auto_auto]"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#141414]">
                        {interview.type}
                      </p>
                      <Badge
                        variant="outline"
                        className={statusMeta.badgeClass}
                      >
                        {statusMeta.label}
                      </Badge>
                    </div>
                    <p className="mt-1 text-xs text-[#777777]">
                      {interview.date} · {interview.duration}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-[#777777]">
                      {RADAR_DIMENSIONS.map((dimension) => (
                        <span
                          key={dimension.key}
                          className="rounded bg-[#F7F7F7] px-2 py-1"
                        >
                          {dimension.label}:{" "}
                          {interview.radarScores[dimension.key]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="mx-auto md:mx-0">
                    <RadarMini scores={interview.radarScores} />
                  </div>
                  <div className="flex items-center justify-between gap-3 md:flex-col md:items-end md:justify-center">
                    <p className="text-xl font-semibold text-[#141414]">
                      {interview.score}
                    </p>
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/interview/${interview.id}`}>
                        {t("interviewHistory.detail")}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })
          )}
          {!isLoading && interviews.length > defaultVisibleCount && (
            <div className="pt-1">
              <Button
                variant="outline"
                className="w-full border-[#E5E5E5]"
                onClick={() => setShowAllInterviews((prev) => !prev)}
              >
                {showAllInterviews
                  ? t("interviewHistory.collapse")
                  : t("interviewHistory.showMore", {
                      count: interviews.length - defaultVisibleCount,
                    })}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-[#E5E5E5] bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-[#141414]">
              {t("questioningReport.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {questioningReportHistory.length === 0 ? (
              <p className="rounded-lg border border-[#EFEFEF] bg-[#FCFCFC] px-4 py-5 text-sm text-[#777777]">
                {t("questioningReport.empty")}
              </p>
            ) : (
              questioningReportHistory.slice(0, 3).map((report) => (
                <div
                  key={report.id}
                  className="rounded-lg border border-[#EFEFEF] px-3 py-2.5"
                >
                  <p className="text-sm font-medium text-[#141414]">
                    {report.title}
                  </p>
                  <p className="mt-1 text-xs text-[#777777]">
                    {report.createdAt}
                  </p>
                </div>
              ))
            )}
            <Button
              asChild
              className="w-full bg-[#0F3E2E] text-white hover:bg-[#0F3E2E]/90"
            >
              <Link href="/questioning">{t("questioningReport.cta")}</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-[#E5E5E5] bg-white shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-[#141414]">
              {t("resumeReport.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resumeReportItems.length === 0 ? (
              <p className="rounded-lg border border-[#EFEFEF] bg-[#FCFCFC] px-4 py-5 text-sm text-[#777777]">
                {t("resumeReport.empty")}
              </p>
            ) : (
              resumeReportItems.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[#EFEFEF] px-3 py-2.5"
                >
                  <p className="text-sm font-medium text-[#141414]">
                    {item.title} · {t("resumeReport.pending")}
                  </p>
                  <p className="mt-1 text-xs text-[#777777]">
                    {item.createdAt}
                  </p>
                </div>
              ))
            )}
            <Button
              asChild
              variant="outline"
              className="w-full border-[#DADADA]"
            >
              <Link href="/resume-review">{t("resumeReport.cta")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <AlertDialog
        open={!!confirmDeletePath}
        onOpenChange={(open) => {
          if (!open && !deletingResumePath) {
            setConfirmDeletePath(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("resumeLibrary.deleteTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("resumeLibrary.deleteConfirm")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              className="cursor-pointer hover:bg-transparent hover:text-inherit"
              disabled={!!deletingResumePath}
            >
              {t("resumeLibrary.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer bg-red-600 hover:bg-red-700"
              onClick={(event) => {
                if (!confirmDeletePath) {
                  return;
                }
                event.preventDefault();
                void handleDeleteResume(confirmDeletePath);
              }}
              disabled={!!deletingResumePath}
            >
              {deletingResumePath ? (
                <span className="inline-flex items-center">
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  {t("resumeLibrary.deleting")}
                </span>
              ) : (
                t("resumeLibrary.confirmDelete")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
