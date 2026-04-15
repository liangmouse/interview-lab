import { NextRequest } from "next/server";
import {
  ensureStepfunRelaySession,
  subscribeToStepfunRelaySession,
} from "@/lib/stepfun-realtime-relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionId = request.nextUrl.searchParams.get("sessionId")?.trim();
  if (!sessionId) {
    return new Response("缺少 sessionId", { status: 400 });
  }

  try {
    ensureStepfunRelaySession(sessionId);
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "会话不存在", {
      status: 404,
    });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const writeMessage = (message: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(message)}\n\n`),
        );
      };

      const unsubscribe = subscribeToStepfunRelaySession(
        sessionId,
        writeMessage,
      );
      const heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 15_000);

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        unsubscribe();
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
