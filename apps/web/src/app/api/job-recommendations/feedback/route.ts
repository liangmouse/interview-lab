import { NextRequest, NextResponse } from "next/server";
import { upsertJobRecommendationFeedback } from "@interviewclaw/data-access";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const body = await request.json();
  const sourceJobId = String(body.sourceJobId || "").trim();
  const action = body.action;
  const jobSnapshot = body.jobSnapshot;

  if (!sourceJobId) {
    return NextResponse.json({ error: "缺少职位标识" }, { status: 400 });
  }

  if (!["saved", "hidden", "not_interested"].includes(action)) {
    return NextResponse.json({ error: "反馈动作无效" }, { status: 400 });
  }

  if (!jobSnapshot || typeof jobSnapshot !== "object") {
    return NextResponse.json({ error: "职位快照无效" }, { status: 400 });
  }

  const supabase = await createClient();
  const feedback = await upsertJobRecommendationFeedback(
    {
      userId: user.id,
      source: "boss",
      sourceJobId,
      action,
      jobSnapshot,
    },
    supabase,
  );

  return NextResponse.json({ data: feedback });
}
