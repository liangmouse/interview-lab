"use client";

import { useCallback, useMemo, useState } from "react";
import { InterviewHeader } from "./interview-header";
import { InterviewResumePanel } from "./interview-resume-panel";
import {
  RealtimeInterviewPanel,
  type RealtimeInterviewStatus,
} from "./realtime-interview-panel";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import {
  parseInterviewType,
  type InterviewDifficulty,
} from "@/lib/interview-session";
import { useUserStore } from "@/store/user";

interface InterviewRoomProps {
  interviewId: string;
  interviewType?: string | null;
  duration?: string | null;
  candidateContext?: RealtimeCandidateContext | null;
  interviewPlan?: RealtimeInterviewPlanContext | null;
}

const DIFFICULTY_LABELS: Record<InterviewDifficulty, string> = {
  beginner: "初级",
  intermediate: "中级",
  advanced: "高级",
  expert: "专家",
};

type RealtimeCandidateContext = {
  jobIntention?: string | null;
  companyIntention?: string | null;
  experienceYears?: number | null;
  skills?: string[] | null;
  bio?: string | null;
  hasResume?: boolean;
  workExperiences?: unknown[] | null;
  projectExperiences?: unknown[] | null;
};

type RealtimeInterviewPlanContext = {
  summary?: string | null;
  plannedTopics?: string[] | null;
  questions?: Array<{
    questionText: string;
    questionType?: string | null;
    topics?: string[] | null;
    expectedSignals?: string[] | null;
  }> | null;
};

function compactText(value: unknown, maxLength = 120) {
  if (typeof value === "string") return value.trim().slice(0, maxLength);
  if (typeof value === "number") return String(value);
  if (!value || typeof value !== "object") return "";

  const record = value as Record<string, unknown>;
  const fields = [
    "title",
    "name",
    "company",
    "role",
    "position",
    "description",
    "summary",
    "responsibilities",
    "achievements",
    "tech_stack",
    "technologies",
  ];
  const parts = fields
    .map((field) => {
      const item = record[field];
      if (Array.isArray(item)) return item.filter(Boolean).join("、");
      return typeof item === "string" || typeof item === "number"
        ? String(item)
        : "";
    })
    .map((item) => item.trim())
    .filter(Boolean);

  return parts.join("，").slice(0, maxLength);
}

function formatExperienceList(label: string, value?: unknown[] | null) {
  const items = Array.isArray(value)
    ? value
        .map((item) => compactText(item))
        .filter(Boolean)
        .slice(0, 3)
    : [];
  if (!items.length) return null;
  return `${label}：${items.map((item, index) => `${index + 1}. ${item}`).join("；")}`;
}

function formatCandidateContext(context?: RealtimeCandidateContext | null) {
  if (!context) return "";

  return [
    context.jobIntention ? `目标岗位：${context.jobIntention}` : null,
    context.companyIntention ? `目标公司：${context.companyIntention}` : null,
    context.experienceYears !== null && context.experienceYears !== undefined
      ? `经验年限：${context.experienceYears} 年`
      : null,
    Array.isArray(context.skills) && context.skills.length
      ? `技能关键词：${context.skills.filter(Boolean).slice(0, 12).join("、")}`
      : null,
    context.bio ? `候选人简介：${context.bio.slice(0, 180)}` : null,
    context.hasResume ? "简历状态：已上传简历，可围绕简历经历追问。" : null,
    formatExperienceList("工作经历摘要", context.workExperiences),
    formatExperienceList("项目经历摘要", context.projectExperiences),
  ]
    .filter(Boolean)
    .join("\n");
}

function formatInterviewPlan(plan?: RealtimeInterviewPlanContext | null) {
  if (!plan) return "";
  const questions = (plan.questions ?? []).slice(0, 6);

  return [
    plan.summary ? `计划摘要：${plan.summary}` : null,
    plan.plannedTopics?.length
      ? `计划覆盖主题：${plan.plannedTopics.slice(0, 10).join("、")}`
      : null,
    questions.length
      ? [
          "参考问题（按需自然使用，不要照本宣科）：",
          ...questions.map((item, index) => {
            const topics = item.topics?.length
              ? `；考点：${item.topics.join("、")}`
              : "";
            const signals = item.expectedSignals?.length
              ? `；观察信号：${item.expectedSignals.slice(0, 4).join("、")}`
              : "";
            return `${index + 1}. ${item.questionText}${topics}${signals}`;
          }),
        ].join("\n")
      : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildRealtimeSystemRole(input: {
  interviewType?: string | null;
  duration?: string | null;
  candidateContext?: RealtimeCandidateContext | null;
  interviewPlan?: RealtimeInterviewPlanContext | null;
}) {
  const parsed = parseInterviewType(input.interviewType);
  const candidateContext = formatCandidateContext(input.candidateContext);
  const interviewPlan = formatInterviewPlan(input.interviewPlan);
  const topic =
    input.candidateContext?.jobIntention?.trim() || parsed.topic || "技术岗位";
  const difficulty = parsed.difficulty
    ? DIFFICULTY_LABELS[parsed.difficulty]
    : "标准";
  const duration = input.duration?.trim();
  const durationLine = duration ? `预计时长：${duration} 分钟。` : "";

  return [
    "你是一位资深中文技术面试官，正在进行一场综合模拟面试。",
    `岗位方向：${topic}。难度：${difficulty}。${durationLine}`,
    candidateContext ? `候选人上下文：\n${candidateContext}` : "",
    interviewPlan ? `面试计划参考：\n${interviewPlan}` : "",
    "请直接开始面试：先用一句自然的问候开场，然后请候选人做简短自我介绍。",
    "面试过程中保持真人对话感，不要念稿，不要一次抛出多个问题。",
    "每轮只问一个问题；根据候选人回答自然追问、澄清或切换到相关技术点。",
    "优先考察项目经历、技术深度、取舍原因、问题排查和沟通表达。",
    "如果候选人回答太短，请温和追问具体场景、指标、个人贡献和技术细节。",
    "请自然推进节奏：开场自我介绍 -> 项目经历深挖 -> 技术原理/系统设计/排障细节 -> 根据时间收尾总结；不要向候选人朗读这些阶段名。",
    "候选人插话或继续回答时，请停止当前展开，优先听完并围绕新信息追问。",
  ].join("\n");
}

export function InterviewRoom({
  interviewId,
  interviewType,
  duration,
  candidateContext,
  interviewPlan,
}: InterviewRoomProps) {
  const resumeUrl = useUserStore((state) => state.userInfo?.resume_url ?? null);
  const hasResumeUrl = Boolean(resumeUrl);
  const [isResumePanelOpen, setIsResumePanelOpen] = useState(
    () => hasResumeUrl,
  );
  const [runtimeStatus, setRuntimeStatus] = useState<RealtimeInterviewStatus>({
    isConnected: false,
    isConnecting: false,
    error: null,
  });

  const systemRole = useMemo(
    () =>
      buildRealtimeSystemRole({
        interviewType,
        duration,
        candidateContext,
        interviewPlan,
      }),
    [candidateContext, duration, interviewPlan, interviewType],
  );

  const handleToggleResumePanel = useCallback(() => {
    if (!hasResumeUrl) return;
    setIsResumePanelOpen((prev) => !prev);
  }, [hasResumeUrl]);

  const realtimePanel = (
    <div className="h-full overflow-hidden">
      <RealtimeInterviewPanel
        interviewId={interviewId}
        title="综合面试"
        systemRole={systemRole}
        speakingStyle="自然、简洁、有追问感，像真实技术面试官一样交流。"
        className="h-full"
        onStatusChange={setRuntimeStatus}
      />
    </div>
  );

  return (
    <div
      data-interview-id={interviewId}
      className="fixed inset-0 flex flex-col bg-[#FDFCF8]"
    >
      <InterviewHeader
        isConnected={runtimeStatus.isConnected}
        isConnecting={runtimeStatus.isConnecting}
        error={runtimeStatus.error}
        isResumePanelOpen={isResumePanelOpen}
        onToggleResumePanel={hasResumeUrl ? handleToggleResumePanel : undefined}
      />

      <div className="flex-1 overflow-hidden">
        {hasResumeUrl && isResumePanelOpen ? (
          <ResizablePanelGroup direction="horizontal" className="h-full w-full">
            <ResizablePanel minSize={20} defaultSize={34} maxSize={60}>
              <InterviewResumePanel resumeUrl={resumeUrl} />
            </ResizablePanel>

            <ResizableHandle withHandle />

            <ResizablePanel defaultSize={66} minSize={40} className="h-full">
              {realtimePanel}
            </ResizablePanel>
          </ResizablePanelGroup>
        ) : (
          realtimePanel
        )}
      </div>
    </div>
  );
}
