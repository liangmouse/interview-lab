import { NextRequest, NextResponse } from "next/server";
import {
  ensureInterviewPlan,
  requireOwnedInterview,
} from "@/lib/interview-rag-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const interviewId = String(body.interviewId || "");

    if (!interviewId) {
      return NextResponse.json({ error: "缺少 interviewId" }, { status: 400 });
    }

    const { profile } = await requireOwnedInterview(interviewId);
    const plan = await ensureInterviewPlan(interviewId, profile);

    return NextResponse.json({ plan });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "生成面试计划失败" },
      { status },
    );
  }
}
