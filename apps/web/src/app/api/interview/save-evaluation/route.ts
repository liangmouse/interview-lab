"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface SaveEvaluationBody {
  interviewId?: string;
  questionId?: string;
  questionText?: string;
  answerText?: string;
  overallScore?: number;
  dimensionScores?: Record<string, number>;
  comment?: string;
  questionAssetId?: string;
  expectedSignals?: string[];
  detectedSignals?: string[];
  missingSignals?: string[];
  riskFlags?: string[];
  answerSpanRefs?: string[];
  confidence?: number;
  followUpReason?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as SaveEvaluationBody;
    const {
      interviewId,
      questionId,
      questionText,
      answerText,
      overallScore,
      dimensionScores,
      comment,
      questionAssetId,
      expectedSignals,
      detectedSignals,
      missingSignals,
      riskFlags,
      answerSpanRefs,
      confidence,
      followUpReason,
    } = body;

    if (
      !interviewId ||
      !questionId ||
      !questionText ||
      !answerText ||
      overallScore === undefined ||
      comment === undefined
    ) {
      return NextResponse.json({ error: "缺少必要参数" }, { status: 400 });
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

    // 确认 interview 属于当前用户
    const { data: interview, error: interviewError } = await supabase
      .from("interviews")
      .select("id, user_id")
      .eq("id", interviewId)
      .single();

    if (interviewError || !interview) {
      return NextResponse.json({ error: "面试不存在" }, { status: 404 });
    }

    // 插入评分记录
    const { error: insertError } = await supabase
      .from("interview_evaluations")
      .insert({
        interview_id: interviewId,
        question_id: questionId,
        question_asset_id: questionAssetId ?? null,
        question_text: questionText,
        answer_text: answerText,
        overall_score: overallScore,
        dimension_scores: dimensionScores ?? {},
        comment,
        expected_signals: expectedSignals ?? [],
        detected_signals: detectedSignals ?? [],
        missing_signals: missingSignals ?? [],
        risk_flags: riskFlags ?? [],
        answer_span_refs: answerSpanRefs ?? [],
        confidence: confidence ?? null,
        follow_up_reason: followUpReason ?? null,
      });

    if (insertError) {
      console.error("[save-evaluation] insert error:", insertError);
      return NextResponse.json({ error: "保存失败" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[save-evaluation] unexpected error:", error);
    return NextResponse.json({ error: "内部错误" }, { status: 500 });
  }
}
