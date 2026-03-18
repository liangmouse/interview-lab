import { NextRequest, NextResponse } from "next/server";
import {
  analyzeInterviewAnswer,
  ensureInterviewPlan,
  requireOwnedInterview,
} from "@/lib/interview-rag-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const interviewId = String(body.interviewId || "");
    const questionId = String(body.questionId || "");
    const answer = String(body.answer || "");

    if (!interviewId || !questionId || !answer.trim()) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const { profile } = await requireOwnedInterview(interviewId);
    const plan = await ensureInterviewPlan(interviewId, profile);
    const result = await analyzeInterviewAnswer({
      plan,
      questionId,
      answer,
    });

    return NextResponse.json({
      question: result.question,
      analysis: result.analysis,
      decision: result.decision,
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "回答分析失败" },
      { status },
    );
  }
}
