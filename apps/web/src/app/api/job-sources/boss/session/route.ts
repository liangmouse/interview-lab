import { NextRequest, NextResponse } from "next/server";
import {
  deleteJobSourceSessionForUser,
  getJobSourceSessionForUser,
  upsertJobSourceSession,
} from "@interviewclaw/data-access";
import {
  BossRateLimitError,
  BossSessionInvalidError,
  BossUpstreamError,
  validateBossSession,
} from "@interviewclaw/llm-apps";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const supabase = await createClient();
  const session = await getJobSourceSessionForUser(user.id, "boss", supabase);
  return NextResponse.json({ data: session });
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const body = await request.json();
  const cookie = String(body.cookie || "").trim();
  if (!cookie) {
    return NextResponse.json({ error: "请粘贴完整 Cookie" }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    const validated = await validateBossSession({
      credential: { cookie },
    });
    const session = await upsertJobSourceSession(
      {
        userId: user.id,
        source: "boss",
        credential: { cookie },
        status: validated.status,
        validationError: undefined,
        lastValidatedAt: validated.lastValidatedAt,
      },
      supabase,
    );

    return NextResponse.json({ data: session });
  } catch (error) {
    if (error instanceof BossSessionInvalidError) {
      const session = await upsertJobSourceSession(
        {
          userId: user.id,
          source: "boss",
          credential: { cookie },
          status: "invalid",
          validationError: error.message,
          lastValidatedAt: new Date().toISOString(),
        },
        supabase,
      );
      return NextResponse.json(
        {
          data: session,
          error: error.message,
        },
        { status: 400 },
      );
    }

    if (error instanceof BossRateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }

    const message =
      error instanceof BossUpstreamError
        ? error.message
        : "BOSS 登录态校验失败，请稍后重试";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const supabase = await createClient();
  await deleteJobSourceSessionForUser(user.id, "boss", supabase);
  return NextResponse.json({ success: true });
}
