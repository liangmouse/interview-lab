import { NextRequest, NextResponse } from "next/server";
import { createResumeGenerationSession } from "@interviewclaw/data-access";
import { createResumeGenerationSessionDraft } from "@interviewclaw/llm-apps";
import { getCurrentUser } from "@/lib/auth";
import {
  isResumeGenerationDirectionPreset,
  isResumeGenerationLanguage,
} from "@/lib/resume-generation";

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const body = await request.json();
  const sourceResumeStoragePath = String(
    body.sourceResumeStoragePath || "",
  ).trim();
  const directionPreset = String(body.directionPreset || "").trim();
  const customStylePrompt = String(body.customStylePrompt || "").trim();
  const language = String(body.language || "zh-CN").trim();

  if (
    !sourceResumeStoragePath ||
    !sourceResumeStoragePath.startsWith(`${user.id}/`)
  ) {
    return NextResponse.json({ error: "请选择有效简历" }, { status: 400 });
  }

  if (!isResumeGenerationDirectionPreset(directionPreset)) {
    return NextResponse.json(
      { error: "请选择有效的投递方向" },
      { status: 400 },
    );
  }

  if (!isResumeGenerationLanguage(language)) {
    return NextResponse.json({ error: "请选择有效语言" }, { status: 400 });
  }

  try {
    const draft = await createResumeGenerationSessionDraft({
      userId: user.id,
      sourceResumeStoragePath,
      directionPreset,
      customStylePrompt: customStylePrompt || undefined,
      language,
    });
    const session = await createResumeGenerationSession({
      userId: user.id,
      sourceResumeStoragePath,
      directionPreset,
      customStylePrompt: customStylePrompt || undefined,
      language,
      sessionStatus: draft.sessionStatus,
      portraitDraft: draft.portraitDraft,
      missingFields: draft.missingFields,
      assistantQuestion: draft.assistantQuestion,
      suggestedAnswerHints: draft.suggestedAnswerHints,
      messages: draft.messages,
    });

    return NextResponse.json({ data: session }, { status: 201 });
  } catch (error) {
    console.error("Failed to create resume generation session:", error);
    return NextResponse.json(
      { error: "简历生成会话创建失败，请稍后重试" },
      { status: 500 },
    );
  }
}
