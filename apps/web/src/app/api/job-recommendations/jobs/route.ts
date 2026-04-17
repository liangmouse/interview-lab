import { NextRequest, NextResponse } from "next/server";
import {
  createJobRecommendationJob,
  getJobSourceSessionForUser,
  listJobRecommendationJobsForUser,
  loadRecommendationUserProfile,
  saveJobSearchPreferencesForUser,
} from "@interviewclaw/data-access";
import type { JobSearchPreferences } from "@interviewclaw/domain";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

function normalizePreferences(value: unknown): JobSearchPreferences {
  const record =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};

  const toStringArray = (input: unknown) =>
    Array.isArray(input)
      ? input
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];
  const toOptionalNumber = (input: unknown) => {
    if (typeof input === "number" && Number.isFinite(input)) {
      return input;
    }
    if (typeof input === "string" && input.trim()) {
      const parsed = Number(input);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  };
  const toOptionalString = (input: unknown) =>
    typeof input === "string" && input.trim() ? input.trim() : undefined;

  return {
    cities: toStringArray(record.cities),
    salaryMinK: toOptionalNumber(record.salaryMinK),
    salaryMaxK: toOptionalNumber(record.salaryMaxK),
    role: toOptionalString(record.role),
    industries: toStringArray(record.industries),
    companySizes: toStringArray(record.companySizes),
  };
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const supabase = await createClient();
  const jobs = await listJobRecommendationJobsForUser(user.id, 20, supabase);
  return NextResponse.json({ data: jobs });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const supabase = await createClient();
  const body = await request.json();
  const mode = body.mode === "manual" ? "manual" : "auto";
  const source = "boss" as const;

  const session = await getJobSourceSessionForUser(user.id, source, supabase);
  if (!session) {
    return NextResponse.json(
      { error: "请先导入 BOSS 登录态后再开始推荐" },
      { status: 400 },
    );
  }

  if (session.status === "invalid") {
    return NextResponse.json(
      { error: session.validationError || "BOSS 登录态已失效，请重新导入" },
      { status: 400 },
    );
  }

  const profile = await loadRecommendationUserProfile(user.id, supabase);
  let savedPreferenceSnapshot = profile?.jobSearchPreferences;

  if (mode === "manual") {
    const manualFilters = normalizePreferences(body.manualFilters);

    if (!manualFilters.role) {
      return NextResponse.json({ error: "请填写岗位" }, { status: 400 });
    }

    if (
      manualFilters.salaryMinK !== undefined &&
      manualFilters.salaryMaxK !== undefined &&
      manualFilters.salaryMinK > manualFilters.salaryMaxK
    ) {
      return NextResponse.json(
        { error: "最高薪资不能低于最低薪资" },
        { status: 400 },
      );
    }

    if (body.savePreferences) {
      savedPreferenceSnapshot = await saveJobSearchPreferencesForUser(
        {
          userId: user.id,
          preferences: manualFilters,
        },
        supabase,
      );
    }

    const job = await createJobRecommendationJob(
      {
        userId: user.id,
        payload: {
          mode,
          source,
          manualFilters,
          ...(savedPreferenceSnapshot ? { savedPreferenceSnapshot } : {}),
        },
      },
      supabase,
    );

    return NextResponse.json({ data: job }, { status: 201 });
  }

  const job = await createJobRecommendationJob(
    {
      userId: user.id,
      payload: {
        mode,
        source,
        ...(savedPreferenceSnapshot ? { savedPreferenceSnapshot } : {}),
      },
    },
    supabase,
  );

  return NextResponse.json({ data: job }, { status: 201 });
}
