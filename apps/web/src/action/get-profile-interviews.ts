"use server";

import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { averageRadarScores, type RawRadarScores } from "@/lib/interview-radar";

interface InterviewRow {
  id: string;
  date: string | null;
  type: string | null;
  score: number | null;
  duration: string | null;
  status: string | null;
}

interface EvaluationRow {
  interview_id: string;
  overall_score: number | null;
  dimension_scores: RawRadarScores | null;
}

export interface ProfileInterviewRecord {
  id: string;
  date: string;
  type: string;
  score: number;
  duration: string;
  status: string;
  radarScores: ReturnType<typeof averageRadarScores>;
}

function formatInterviewDate(date: string | null): string {
  if (!date) {
    return "-";
  }
  return new Date(date).toLocaleDateString("zh-CN");
}

function formatInterviewType(type: string | null): string {
  if (!type) {
    return "模拟面试";
  }

  if (type.includes(":")) {
    const [topic, level] = type.split(":");
    return `${topic} (${level})`;
  }

  return type;
}

function formatInterviewDuration(duration: string | null): string {
  if (!duration?.trim()) {
    return "-";
  }

  if (/^\d+$/.test(duration)) {
    return `${duration}分钟`;
  }

  return duration;
}

export async function getProfileInterviews(): Promise<
  ProfileInterviewRecord[]
> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) {
    return [];
  }

  try {
    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      console.error(
        "Error fetching user profile for interviews:",
        profileError,
      );
      return [];
    }

    const { data: interviews, error: interviewsError } = await supabase
      .from("interviews")
      .select("id, date, type, score, duration, status")
      .eq("user_id", profile.id)
      .order("date", { ascending: false })
      .limit(20);

    if (interviewsError) {
      console.error("Error fetching interviews for profile:", interviewsError);
      return [];
    }

    const interviewRows = (interviews ?? []) as InterviewRow[];
    if (interviewRows.length === 0) {
      return [];
    }

    const interviewIds = interviewRows.map((item) => item.id);
    let evaluationRows: EvaluationRow[] = [];

    // interview_evaluations 在部分环境可能不存在，失败时降级即可。
    const { data: evaluations, error: evaluationsError } = await supabase
      .from("interview_evaluations")
      .select("interview_id, overall_score, dimension_scores")
      .in("interview_id", interviewIds);

    if (evaluationsError) {
      console.warn(
        "Error fetching interview evaluations, fallback to interview scores:",
        evaluationsError,
      );
    } else {
      evaluationRows = (evaluations ?? []) as EvaluationRow[];
    }

    const evaluationMap = new Map<string, EvaluationRow[]>();
    evaluationRows.forEach((row) => {
      const rows = evaluationMap.get(row.interview_id) ?? [];
      rows.push(row);
      evaluationMap.set(row.interview_id, rows);
    });

    return interviewRows.map((interview) => {
      const relatedEvaluations = evaluationMap.get(interview.id) ?? [];

      const radarSourceList: RawRadarScores[] =
        relatedEvaluations
          .map((item) => item.dimension_scores)
          .filter((item): item is RawRadarScores => !!item) || [];

      // 没有维度评分时，用总分作为兜底，让雷达图仍可展示。
      if (radarSourceList.length === 0 && typeof interview.score === "number") {
        radarSourceList.push({
          professional: interview.score,
          confidence: interview.score,
          expression: interview.score,
          logic: interview.score,
          adaptability: interview.score,
        });
      }

      return {
        id: interview.id,
        date: formatInterviewDate(interview.date),
        type: formatInterviewType(interview.type),
        score: interview.score ?? 0,
        duration: formatInterviewDuration(interview.duration),
        status: interview.status || "pending",
        radarScores: averageRadarScores(radarSourceList),
      };
    });
  } catch (error) {
    console.error("Unexpected error fetching profile interviews:", error);
    return [];
  }
}
