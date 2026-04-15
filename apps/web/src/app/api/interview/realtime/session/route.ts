import { NextRequest, NextResponse } from "next/server";
import { requireOwnedInterview } from "@/lib/interview-rag-service";
import {
  closeStepfunRelaySession,
  createStepfunRelaySession,
} from "@/lib/stepfun-realtime-relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function requireEnv(name: string) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`缺少环境变量 ${name}`);
  }
  return value;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const interviewId = String(body.interviewId || "");
    if (!interviewId) {
      return NextResponse.json({ error: "缺少 interviewId" }, { status: 400 });
    }

    await requireOwnedInterview(interviewId);

    const wsBaseUrl = (
      process.env.STEPFUN_REALTIME_WS_URL?.trim() ||
      "wss://api.stepfun.com/v1/realtime"
    ).replace(/\/$/, "");
    const model = process.env.STEPFUN_REALTIME_MODEL?.trim() || "step-audio-2";
    const apiKey = requireEnv("STEPFUN_REALTIME_API_KEY");
    const voice =
      process.env.STEPFUN_REALTIME_VOICE?.trim() || "livelybreezy-female";
    const inputSampleRate = Number(
      process.env.STEPFUN_REALTIME_INPUT_SAMPLE_RATE || "16000",
    );
    const outputSampleRate = Number(
      process.env.STEPFUN_REALTIME_OUTPUT_SAMPLE_RATE || "16000",
    );
    const wsUrl = `${wsBaseUrl}?model=${encodeURIComponent(model)}`;
    const relaySession = await createStepfunRelaySession({
      interviewId,
      wsUrl,
      apiKey,
    });

    return NextResponse.json({
      voiceKernel: "stepfun-realtime",
      sessionConfig: {
        transport: "server-relay",
        sessionId: relaySession.sessionId,
        eventsUrl: `/api/interview/realtime/events?sessionId=${encodeURIComponent(relaySession.sessionId)}`,
        inputUrl: `/api/interview/realtime/input?sessionId=${encodeURIComponent(relaySession.sessionId)}`,
        model,
        voice,
        inputSampleRate,
        outputSampleRate,
        instructions:
          "你是中文技术模拟面试中的实时语音执行器。主要职责是稳定转写用户语音，并把系统提供的中文面试话术自然地说出来。",
      },
      expiresAt: relaySession.expiresAt,
    });
  } catch (error) {
    const status = (error as { status?: number }).status ?? 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "创建实时语音会话失败",
      },
      { status },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const sessionId = request.nextUrl.searchParams.get("sessionId")?.trim();
    if (!sessionId) {
      return NextResponse.json({ error: "缺少 sessionId" }, { status: 400 });
    }

    closeStepfunRelaySession(sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "关闭实时语音会话失败",
      },
      { status: 500 },
    );
  }
}
