import { NextRequest, NextResponse } from "next/server";
import {
  getResumeGenerationSessionForUser,
  updateResumeGenerationSession,
} from "@interviewclaw/data-access";
import { continueResumeGenerationSession } from "@interviewclaw/llm-apps";
import { getCurrentUser } from "@/lib/auth";

interface ResumeGenerationMessageRouteProps {
  params: Promise<{ id: string }>;
}

export async function POST(
  request: NextRequest,
  { params }: ResumeGenerationMessageRouteProps,
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const answer = String(body.answer || "").trim();

  if (!answer) {
    return NextResponse.json({ error: "请输入补充信息" }, { status: 400 });
  }

  const session = await getResumeGenerationSessionForUser(id, user.id);
  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  if (session.sessionStatus === "archived") {
    return NextResponse.json(
      { error: "会话已归档，无法继续补充" },
      { status: 400 },
    );
  }

  try {
    const nextState = await continueResumeGenerationSession(session, answer);
    const updatedSession = await updateResumeGenerationSession({
      sessionId: session.id,
      userId: user.id,
      sessionStatus: nextState.sessionStatus,
      portraitDraft: nextState.portraitDraft,
      missingFields: nextState.missingFields,
      assistantQuestion: nextState.assistantQuestion ?? null,
      suggestedAnswerHints: nextState.suggestedAnswerHints,
      messages: nextState.messages,
    });

    return NextResponse.json({ data: updatedSession });
  } catch (error) {
    console.error("Failed to continue resume generation session:", error);
    return NextResponse.json(
      { error: "补充信息提交失败，请稍后重试" },
      { status: 500 },
    );
  }
}
