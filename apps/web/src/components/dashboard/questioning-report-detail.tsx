import type {
  QuestionType,
  QuestioningQuestion,
  QuestioningReport,
} from "@interviewclaw/domain";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BookOpenText,
  ClipboardList,
  Lightbulb,
  MessagesSquare,
  Radar,
  Sparkles,
  Target,
} from "lucide-react";
import { FormattedDate } from "@/components/formatted-date";
import { cn } from "@/lib/utils";

const TRACK_LABELS = {
  social: "社招",
  campus: "校招（含实习）",
} as const;

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  knowledge: "知识考察",
  project: "项目追问",
  algorithm: "算法能力",
  system_design: "系统设计",
  behavioral: "行为面试",
};

const WRAP_TEXT_CLASS =
  "whitespace-normal break-words [overflow-wrap:anywhere]";

const HIGHLIGHT_TITLE_PATTERNS = [
  {
    match: /(完整的?\s*Agent\s*项目故事|Agent\s*项目故事)/i,
    title: "完整 Agent 项目故事",
  },
  {
    match: /TypeScript.*高级类型|高级类型.*TypeScript/i,
    title: "TypeScript 高级类型",
  },
  {
    match: /LLM.*工程化|Function Calling|Tool Use/i,
    title: "LLM 工程化细节",
  },
  {
    match: /Agent.*记忆|短期记忆|长期记忆|工作记忆/i,
    title: "Agent 记忆管理",
  },
  {
    match: /类库|SDK|API 设计|开发者体验|DX/i,
    title: "类库 / SDK API 设计",
  },
  {
    match: /系统设计.*前端|前端视角.*系统设计/i,
    title: "前端视角的系统设计",
  },
  {
    match: /技术选型|trade-off|LangChain|Vercel AI SDK|自研框架/i,
    title: "技术选型与 Trade-off",
  },
  {
    match: /行为面试|STAR|工程治理|项目复盘/i,
    title: "行为面试与工程表达",
  },
] as const;

function normalizeText(value?: string | null) {
  return value?.trim() ?? "";
}

function normalizeItems(items?: string[] | null) {
  return (items ?? []).map((item) => item.trim()).filter(Boolean);
}

function stripHighlightPrefix(highlight: string) {
  return highlight
    .replace(/^[【\[]?最高优先级[】\]]?/g, "")
    .replace(/^(重点准备|准备|聚焦)\s*/g, "")
    .trim();
}

function buildHighlightMeta(highlight: string) {
  const normalized = stripHighlightPrefix(highlight);
  const matchedPattern = HIGHLIGHT_TITLE_PATTERNS.find(({ match }) =>
    match.test(normalized),
  );
  const separator = normalized.match(/[：:；;]/);

  if (matchedPattern) {
    const body =
      separator && separator.index !== undefined
        ? normalized.slice(separator.index + 1).trim()
        : normalized
            .replace(/^(准备一个|准备|聚焦|重点)\s*/g, "")
            .replace(matchedPattern.match, "")
            .replace(
              /^(是核心考点|必须熟练|要有自己的理解|思维|的理由)\s*/g,
              "",
            )
            .replace(/^[：:;；,\s]+/, "")
            .trim();

    return {
      title: matchedPattern.title,
      body: body || normalized,
    };
  }

  if (!separator || separator.index === undefined) {
    return {
      title: normalized.slice(0, 18).trim(),
      body: normalized,
    };
  }

  const title = normalized.slice(0, separator.index).trim();
  const body = normalized.slice(separator.index + 1).trim();

  return {
    title: title || "重点准备项",
    body: body || normalized,
  };
}

function OverviewMetric({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  helper?: string;
}) {
  return (
    <div className="min-w-0 rounded-3xl border border-white/80 bg-white/90 p-4 shadow-[0_18px_40px_-30px_rgba(20,40,34,0.35)] backdrop-blur-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-[#547065]">
        <Icon className="h-4 w-4 text-[#2A6955]" />
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "mt-3 text-base font-semibold text-[#141414] sm:text-lg",
          WRAP_TEXT_CLASS,
        )}
      >
        {value}
      </div>
      {helper ? <p className="mt-2 text-xs text-[#6D8078]">{helper}</p> : null}
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  eyebrow,
  title,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-sm font-medium text-[#4E685E]">
          <Icon className="h-4 w-4 text-[#2A6955]" />
          <span>{eyebrow}</span>
        </div>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-[#141414]">
          {title}
        </h2>
      </div>
    </div>
  );
}

function NotePanel({
  title,
  content,
  accent = false,
}: {
  title: string;
  content: string;
  accent?: boolean;
}) {
  if (!content) {
    return null;
  }

  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border p-4",
        accent
          ? "border-[#D5E7DE] bg-[#F6FBF8]"
          : "border-[#ECEFED] bg-[#FAFAF8]",
      )}
    >
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#6C8078]">
        {title}
      </p>
      <p
        className={cn("mt-3 text-sm leading-7 text-[#233C34]", WRAP_TEXT_CLASS)}
      >
        {content}
      </p>
    </div>
  );
}

function ChipPanel({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="min-w-0 rounded-2xl border border-[#ECEFED] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#6C8078]">
        {title}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <span
            key={item}
            className={cn(
              "min-w-0 max-w-full rounded-full border border-[#D9E6E0] bg-[#F7FBF9] px-3 py-1.5 text-sm leading-6 text-[#28493F]",
              WRAP_TEXT_CLASS,
            )}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function FollowUpPanel({ items }: { items: string[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="min-w-0 rounded-2xl border border-[#ECEFED] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-[0.14em] text-[#6C8078]">
        可能追问
      </p>
      <div className="mt-3 grid gap-2">
        {items.map((item, index) => (
          <div
            key={`${index + 1}-${item}`}
            className="min-w-0 rounded-2xl border border-dashed border-[#D9E6E0] bg-[#FAFCFB] px-3 py-3"
          >
            <p className="text-xs font-medium text-[#6C8078]">
              追问 {index + 1}
            </p>
            <p
              className={cn(
                "mt-1 text-sm leading-7 text-[#28493F]",
                WRAP_TEXT_CLASS,
              )}
            >
              {item}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionCard({
  question,
  index,
}: {
  question: QuestioningQuestion;
  index: number;
}) {
  const category =
    normalizeText(question.category) || normalizeText(question.reason);
  const selectionReason = normalizeText(question.reason);
  const preparationAdvice = normalizeText(question.preparationAdvice);
  const answerGuide = normalizeText(question.answerGuide);
  const referenceAnswer = normalizeText(question.referenceAnswer);
  const topics = normalizeItems(question.topics);
  const expectedSignals = normalizeItems(question.expectedSignals);
  const followUps = normalizeItems(question.followUps);

  const distinctReason =
    selectionReason && selectionReason !== category ? selectionReason : "";
  const distinctAnswerGuide =
    answerGuide && answerGuide !== preparationAdvice ? answerGuide : "";
  const hasAside =
    topics.length > 0 || expectedSignals.length > 0 || followUps.length > 0;

  return (
    <article className="min-w-0 overflow-hidden rounded-[28px] border border-[#E6ECE8] bg-white p-5 shadow-[0_20px_48px_-34px_rgba(18,52,42,0.34)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 min-w-9 items-center justify-center rounded-full bg-[#173B32] px-3 text-sm font-semibold text-white">
              {String(index + 1).padStart(2, "0")}
            </span>
            {category ? (
              <span
                className={cn(
                  "inline-flex max-w-full items-center rounded-full border border-[#D7E6DF] bg-[#F7FBF9] px-3 py-1.5 text-sm font-medium text-[#23473C]",
                  WRAP_TEXT_CLASS,
                )}
              >
                {category}
              </span>
            ) : null}
            <span className="inline-flex items-center rounded-full border border-[#E4E9E6] bg-[#FCFDFC] px-3 py-1 text-xs font-medium text-[#61766D]">
              {QUESTION_TYPE_LABELS[question.questionType] ?? "重点问题"}
            </span>
          </div>
          <h3
            className={cn(
              "max-w-full text-lg font-semibold leading-8 text-[#141414] sm:text-[22px]",
              WRAP_TEXT_CLASS,
            )}
          >
            {question.questionText}
          </h3>
        </div>
      </div>

      <div
        className={cn(
          "mt-5 grid gap-4",
          hasAside && "2xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]",
        )}
      >
        <div className="grid gap-4">
          {distinctReason ? (
            <NotePanel title="入选理由" content={distinctReason} />
          ) : null}
          {preparationAdvice ? (
            <NotePanel title="准备建议" content={preparationAdvice} accent />
          ) : null}
          {distinctAnswerGuide ? (
            <NotePanel title="回答框架" content={distinctAnswerGuide} />
          ) : null}
          {referenceAnswer ? (
            <NotePanel title="参考答法" content={referenceAnswer} />
          ) : null}
        </div>

        {hasAside ? (
          <div className="grid gap-4">
            <ChipPanel title="考点标签" items={topics} />
            <ChipPanel title="答题信号" items={expectedSignals} />
            <FollowUpPanel items={followUps} />
          </div>
        ) : null}
      </div>
    </article>
  );
}

export function QuestioningReportDetail({
  report,
}: {
  report: QuestioningReport;
}) {
  const trackLabel = TRACK_LABELS[report.track];

  return (
    <main className="flex-1 overflow-y-auto bg-[linear-gradient(180deg,#f6f6f2_0%,#f9faf7_16%,#f5f8f6_100%)] px-4 py-5 sm:px-6 lg:px-8">
      <section className="mx-auto w-full max-w-[1440px]">
        <div className="overflow-hidden rounded-[32px] border border-[#E4EBE6] bg-white shadow-[0_32px_90px_-56px_rgba(18,49,40,0.42)]">
          <div className="relative overflow-hidden border-b border-[#EDF2EE] bg-[linear-gradient(135deg,#ffffff_0%,#f8fbf9_52%,#eef7f2_100%)] px-6 py-8 sm:px-8 lg:px-10 lg:py-10">
            <div className="pointer-events-none absolute -right-20 -top-10 h-64 w-64 rounded-full bg-[#D7EBDD]/70 blur-3xl" />
            <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-[#F1F7F3] blur-3xl" />

            <div className="relative grid gap-8 xl:grid-cols-[minmax(0,1.55fr)_360px]">
              <div className="min-w-0 space-y-6">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-full bg-[#EAF4EE] px-4 py-2 text-base font-semibold text-[#21483D]">
                    {trackLabel}
                  </span>
                  <span className="text-sm font-medium text-[#6A7D76]">
                    <FormattedDate value={report.createdAt} />
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#DDE7E2] bg-white/85 px-3 py-1.5 text-sm font-medium text-[#4C655C]">
                    <Sparkles className="h-4 w-4 text-[#2A6955]" />共{" "}
                    {report.questions.length} 道重点题
                  </span>
                </div>

                <div className="min-w-0 space-y-4">
                  <h1
                    className={cn(
                      "max-w-5xl text-3xl font-semibold tracking-tight text-[#141414] sm:text-4xl lg:text-[46px] lg:leading-[1.15]",
                      WRAP_TEXT_CLASS,
                    )}
                  >
                    {report.title}
                  </h1>
                  <p
                    className={cn(
                      "max-w-4xl text-base leading-8 text-[#355348] sm:text-[17px]",
                      WRAP_TEXT_CLASS,
                    )}
                  >
                    {report.summary}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                <OverviewMetric
                  icon={Target}
                  label="目标岗位"
                  value={report.targetRole}
                />
                <OverviewMetric
                  icon={Radar}
                  label="聚焦维度"
                  value={`${report.highlights.length} 项高优先准备`}
                  helper="把最该准备的主题前置，优先把高频追问补齐。"
                />
                <OverviewMetric
                  icon={ClipboardList}
                  label="重点题单"
                  value={`${report.questions.length} 道模拟题`}
                  helper="每道题都按问题、建议、追问拆开整理。"
                />
                <OverviewMetric
                  icon={BookOpenText}
                  label="使用方式"
                  value="先读概览，再逐题练习"
                  helper="适合直接照着准备、复述和模拟问答。"
                />
              </div>
            </div>
          </div>

          <div className="space-y-8 px-6 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-10">
            <section className="space-y-5">
              <SectionHeader
                icon={Lightbulb}
                eyebrow="报告聚焦"
                title="高优先准备维度"
              />

              <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                {report.highlights.map((highlight, index) => {
                  const highlightMeta = buildHighlightMeta(highlight);

                  return (
                    <article
                      key={`${index + 1}-${highlight}`}
                      className="min-w-0 rounded-[24px] border border-[#DDE9E3] bg-[linear-gradient(180deg,#fbfdfc_0%,#f6faf8_100%)] p-5 shadow-[0_18px_42px_-34px_rgba(30,70,55,0.36)]"
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-full bg-[#1F4C3F] text-sm font-semibold text-white">
                          {index + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#6A7F76]">
                            Focus
                          </p>
                          <h3
                            className={cn(
                              "mt-1 text-lg font-semibold text-[#1F3B33]",
                              WRAP_TEXT_CLASS,
                            )}
                          >
                            {highlightMeta.title}
                          </h3>
                        </div>
                      </div>
                      <p
                        className={cn(
                          "mt-4 text-[15px] leading-8 text-[#26453A]",
                          WRAP_TEXT_CLASS,
                        )}
                      >
                        {highlightMeta.body}
                      </p>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="space-y-5">
              <SectionHeader
                icon={MessagesSquare}
                eyebrow="逐题准备"
                title="逐题准备清单"
              />
              <div className="grid gap-4">
                {report.questions.map((question, index) => (
                  <QuestionCard
                    key={question.questionId}
                    question={question}
                    index={index}
                  />
                ))}
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
