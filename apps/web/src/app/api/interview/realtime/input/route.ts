import { NextRequest, NextResponse } from "next/server";
import {
  ensureStepfunRelaySession,
  sendStepfunRelayEvent,
} from "@/lib/stepfun-realtime-relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function parseInputEvents(request: NextRequest) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      events?: Record<string, unknown>[];
      event?: Record<string, unknown>;
    } | null;

    if (Array.isArray(body?.events)) {
      return body.events;
    }

    if (body?.event && typeof body.event === "object") {
      return [body.event];
    }

    return [];
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return null;
  }

  const decoder = new TextDecoder();
  let buffer = "";
  const events: Record<string, unknown>[] = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");

    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex).trim();
      buffer = buffer.slice(newlineIndex + 1);

      if (line) {
        events.push(JSON.parse(line) as Record<string, unknown>);
      }

      newlineIndex = buffer.indexOf("\n");
    }
  }

  const tail = buffer.trim();
  if (tail) {
    events.push(JSON.parse(tail) as Record<string, unknown>);
  }

  return events;
}

export async function POST(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")?.trim();
  if (!sessionId) {
    return NextResponse.json({ error: "缺少 sessionId" }, { status: 400 });
  }

  try {
    ensureStepfunRelaySession(sessionId);

    const events = await parseInputEvents(request);
    if (!events) {
      return NextResponse.json({ error: "缺少输入流" }, { status: 400 });
    }
    events.forEach((event) => {
      sendStepfunRelayEvent(sessionId, event);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "写入 StepFun 实时输入失败",
      },
      { status: 500 },
    );
  }
}
