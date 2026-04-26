import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const token = process.env.VOLC_REALTIME_BROWSER_API_KEY;
  const appId = process.env.VOLCENGINE_STT_APP_ID;
  const accessToken = process.env.VOLCENGINE_STT_ACCESS_TOKEN;
  const port = process.env.GATEWAY_PORT || "8787";
  const gatewayUrl =
    process.env.VOICE_GATEWAY_WS_URL || `ws://localhost:${port}/voice/realtime`;
  const missingEnv = [
    !token ? "VOLC_REALTIME_BROWSER_API_KEY" : null,
    !appId ? "VOLCENGINE_STT_APP_ID" : null,
    !accessToken ? "VOLCENGINE_STT_ACCESS_TOKEN" : null,
  ].filter((key): key is string => Boolean(key));

  if (missingEnv.length > 0) {
    return NextResponse.json(
      {
        error: `实时语音配置缺失: ${missingEnv.join(", ")}`,
        missingEnv,
      },
      { status: 503 },
    );
  }

  return NextResponse.json(
    { token, gatewayUrl },
    { headers: { "cache-control": "no-store" } },
  );
}
