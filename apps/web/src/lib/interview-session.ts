export type InterviewTopic = string;

export type InterviewDifficulty =
  | "beginner"
  | "intermediate"
  | "advanced"
  | "expert";

export type InterviewSessionVariant = "standard" | "coding";

export type ParsedInterviewType = {
  raw: string;
  topic: InterviewTopic | null;
  difficulty: InterviewDifficulty | null;
  variant: InterviewSessionVariant;
};

const INTERVIEW_DIFFICULTIES = new Set<InterviewDifficulty>([
  "beginner",
  "intermediate",
  "advanced",
  "expert",
]);

export const FOCUS_CODING_TOPIC: InterviewTopic = "fullstack";
export const CODING_INTERVIEW_DEFAULT_DURATION_MINUTES = 60;
export const CODING_INTERVIEW_QUESTION_COUNT = 3;
export const CODING_INTERVIEW_RESUME_TO_LEETCODE_RATIO = {
  resume: 2,
  leetcode: 3,
} as const;

export function normalizeInterviewTopic(topic: string) {
  return topic
    .trim()
    .replace(/[:：]+/g, " ")
    .replace(/\s+/g, " ");
}

export function buildInterviewType(input: {
  topic: InterviewTopic;
  difficulty: InterviewDifficulty;
  variant?: InterviewSessionVariant;
}) {
  const normalizedTopic = normalizeInterviewTopic(input.topic);
  const base = `${normalizedTopic}:${input.difficulty}`;
  return input.variant === "coding" ? `${base}:coding` : base;
}

export function parseInterviewType(
  value: string | null | undefined,
): ParsedInterviewType {
  const raw = typeof value === "string" ? value : "";
  const segments = raw
    .split(":")
    .map((segment) => segment.trim())
    .filter(Boolean);

  const difficulty = segments.find((segment): segment is InterviewDifficulty =>
    INTERVIEW_DIFFICULTIES.has(segment as InterviewDifficulty),
  );
  const topicSegment = segments.find(
    (segment) =>
      !INTERVIEW_DIFFICULTIES.has(segment as InterviewDifficulty) &&
      segment !== "coding",
  );
  const variant: InterviewSessionVariant = segments.includes("coding")
    ? "coding"
    : "standard";

  return {
    raw,
    topic: topicSegment ?? null,
    difficulty: difficulty ?? null,
    variant,
  };
}

export function isCodingInterviewType(value: string | null | undefined) {
  return parseInterviewType(value).variant === "coding";
}
