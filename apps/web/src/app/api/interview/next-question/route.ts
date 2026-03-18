import { NextRequest, NextResponse } from "next/server";
import {
  analyzeInterviewAnswer,
  ensureInterviewPlan,
  getCurrentQuestion,
  persistDecisionArtifacts,
  requireOwnedInterview,
} from "@/lib/interview-rag-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const interviewId = String(body.interviewId || "");
    const currentQuestionId = body.currentQuestionId
      ? String(body.currentQuestionId)
      : undefined;
    const answer = typeof body.answer === "string" ? body.answer : "";

    if (!interviewId) {
      return NextResponse.json({ error: "缺少 interviewId" }, { status: 400 });
    }

    const { profile } = await requireOwnedInterview(interviewId);
    const plan = await ensureInterviewPlan(interviewId, profile);

    if (!currentQuestionId || !answer.trim()) {
      const { question, index } = getCurrentQuestion(plan, currentQuestionId);
      return NextResponse.json({
        question,
        index,
        decision: {
          action: "switch_topic",
          reason: "返回当前计划中的主问题。",
          shouldAdvance: true,
          nextQuestionId: question.questionId,
          questionText: question.questionText,
        },
      });
    }

    const result = await analyzeInterviewAnswer({
      plan,
      questionId: currentQuestionId,
      answer,
    });
    await persistDecisionArtifacts({
      interviewId,
      question: result.question,
      questionIndex: result.index,
      analysis: result.analysis,
      decision: result.decision,
      plan,
    });

    return NextResponse.json({
      currentQuestion: result.question,
      analysis: result.analysis,
      decision: result.decision,
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "获取下一题失败" },
      { status },
    );
  }
}
