import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  analyzeInterviewAnswer,
  buildTraceFromAnalysis,
  generateDynamicInterviewEvaluation,
  loadExistingInterviewPlan,
  persistDecisionArtifacts,
  requireOwnedInterview,
} from "@/lib/interview-rag-service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const interviewId = String(body.interviewId || "");
    const questionId = String(body.questionId || "");
    const questionText = String(body.questionText || "");
    const answer = String(body.answer || "");

    if (!interviewId || !questionId || !questionText.trim() || !answer.trim()) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
    }

    const { profile, interview } = await requireOwnedInterview(interviewId);
    const plan = await loadExistingInterviewPlan(interviewId);

    let currentQuestion: { questionId: string; questionText: string };
    let decision: {
      shouldAdvance: boolean;
      nextQuestionId?: string;
      questionText: string;
      action: string;
      reason: string;
    };
    let trace;
    let overallScore: number;

    if (plan) {
      const result = await analyzeInterviewAnswer({
        plan,
        questionId,
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

      trace = buildTraceFromAnalysis({
        answer,
        question: result.question,
        analysis: result.analysis,
        decision: result.decision,
      });
      overallScore = Math.round(
        Object.values(trace.scoreByDimension).reduce(
          (sum, value) => sum + value,
          0,
        ) / Object.keys(trace.scoreByDimension).length,
      );
      currentQuestion = {
        questionId: result.question.questionId,
        questionText: result.question.questionText,
      };
      decision = result.decision;
    } else {
      const result = await generateDynamicInterviewEvaluation({
        interviewId,
        profile,
        questionId,
        questionText,
        answer,
      });
      trace = result.trace;
      overallScore = result.overallScore;
      currentQuestion = {
        questionId: result.currentQuestion.questionId,
        questionText: result.currentQuestion.questionText,
      };
      decision = result.decision;
    }

    const supabase = await createClient();
    const { error } = await supabase.from("interview_evaluations").insert({
      interview_id: interviewId,
      question_id: questionId,
      question_asset_id: plan ? questionId : null,
      question_text: currentQuestion.questionText,
      answer_text: answer,
      overall_score: overallScore,
      dimension_scores: trace.scoreByDimension,
      comment: trace.finalComment,
      expected_signals: trace.expectedSignals,
      detected_signals: trace.detectedSignals,
      missing_signals: trace.missingSignals,
      risk_flags: trace.riskFlags,
      answer_span_refs: trace.candidateAnswerSpan,
      confidence: trace.confidence,
      follow_up_reason: trace.followUpReason,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      trace,
      overallScore,
      currentQuestion,
      decision,
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "回合评估失败" },
      { status },
    );
  }
}
