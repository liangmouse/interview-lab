import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserAccessForUserId } from "@/lib/billing/access";

export async function GET(request: NextRequest) {
  try {
    const interviewId = request.nextUrl.searchParams.get("interviewId");
    if (!interviewId) {
      return NextResponse.json({ error: "缺少 interviewId" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "未登录或登录已过期" },
        { status: 401 },
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "用户资料不存在" }, { status: 404 });
    }

    const { data: interview, error: interviewError } = await supabase
      .from("interviews")
      .select("id")
      .eq("id", interviewId)
      .eq("user_id", profile.id)
      .single();

    if (interviewError || !interview) {
      return NextResponse.json({ error: "面试不存在" }, { status: 404 });
    }

    const access = await resolveUserAccessForUserId(user.id, supabase);
    const { data, error } = await supabase
      .from("interview_evaluations")
      .select(
        "question_id, question_text, answer_text, overall_score, dimension_scores, comment",
      )
      .eq("interview_id", interviewId)
      .order("created_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const sanitized = (data ?? []).map((item) =>
      access.canViewFullReport
        ? item
        : {
            question_id: item.question_id,
            question_text: item.question_text,
            overall_score: item.overall_score,
          },
    );

    return NextResponse.json({
      access,
      report: sanitized,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "获取报告失败",
      },
      { status: 500 },
    );
  }
}
