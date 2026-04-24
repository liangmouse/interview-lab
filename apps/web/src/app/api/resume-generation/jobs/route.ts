import { NextRequest, NextResponse } from "next/server";
import {
  createResumeGenerationJob,
  getResumeGenerationSessionForUser,
  listResumeGenerationJobsForUser,
} from "@interviewclaw/data-access";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  try {
    const jobs = await listResumeGenerationJobsForUser(user.id, 20);
    return NextResponse.json({ data: jobs });
  } catch (error) {
    console.error("Failed to list resume generation jobs:", error);
    return NextResponse.json(
      { error: "简历生成任务加载失败，请稍后重试" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const body = await request.json();
  const sessionId = String(body.sessionId || "").trim();
  if (!sessionId) {
    return NextResponse.json({ error: "缺少会话 ID" }, { status: 400 });
  }

  const session = await getResumeGenerationSessionForUser(sessionId, user.id);
  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }

  if (session.sessionStatus !== "ready") {
    return NextResponse.json(
      { error: "当前信息还不完整，请继续补充后再生成" },
      { status: 400 },
    );
  }

  try {
    const job = await createResumeGenerationJob({
      userId: user.id,
      payload: {
        sourceResumeStoragePath: session.sourceResumeStoragePath,
        directionPreset: session.directionPreset,
        customStylePrompt: session.customStylePrompt,
        language: session.language,
        portraitSnapshot: session.portraitDraft,
        sessionId: session.id,
      },
    });
    return NextResponse.json({ data: job }, { status: 201 });
  } catch (error) {
    console.error("Failed to create resume generation job:", error);
    return NextResponse.json(
      { error: "简历生成任务创建失败，请稍后重试" },
      { status: 500 },
    );
  }
}
