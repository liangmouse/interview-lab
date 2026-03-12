/**
 * LiveKit Token API
 *
 * 为前端用户生成 LiveKit 房间的 access token
 * 这个 token 允许用户加入指定的面试房间，与 AI Agent 进行语音交互
 */

import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { createClient } from "@/lib/supabase/server";

// LiveKit 配置（从环境变量读取）
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

export async function POST(request: NextRequest) {
  try {
    // 检查 LiveKit 配置
    if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
      console.error("[livekit/token] Missing LiveKit configuration");
      return NextResponse.json(
        { error: "LiveKit 配置缺失，请联系管理员" },
        { status: 500 },
      );
    }

    // 解析请求体
    const body = await request.json();
    const { interviewId, locale } = body;

    if (!interviewId) {
      return NextResponse.json(
        { error: "缺少 interviewId 参数" },
        { status: 400 },
      );
    }

    // 获取当前用户信息
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "未登录或登录已过期" },
        { status: 401 },
      );
    }

    // 生成房间名（优先使用开发模式指定的固定房间名）
    const isFixedRoomMode = process.env.FIXED_ROOM_MODE === "true";
    const devRoomName = process.env.DEV_ROOM_NAME;
    const roomName =
      isFixedRoomMode && devRoomName ? devRoomName : `interview-${interviewId}`;

    if (isFixedRoomMode && devRoomName) {
      console.warn(
        `[livekit/token] FIXED ROOM MODE ENABLED: Using room "${roomName}"`,
      );
    }

    // 生成用户标识（使用用户 ID + 邮箱前缀）
    const participantIdentity = user.id;
    const participantName =
      user.user_metadata?.full_name || user.email?.split("@")[0] || "Candidate";

    // 创建 LiveKit Access Token
    const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantIdentity,
      name: participantName,
      // 将语言信息存入 metadata，供 Agent 读取
      metadata: JSON.stringify({ locale: locale || "zh" }),
      // Token 有效期：2 小时
      ttl: 60 * 60 * 2,
    });

    // 授予房间权限
    token.addGrant({
      room: roomName,
      roomJoin: true,
      // 允许发布音频（用户说话）
      canPublish: true,
      // 允许订阅（听 Agent 说话）
      canSubscribe: true,
      // 允许发送数据（用于 RPC）
      canPublishData: true,
    });

    // 生成 JWT token
    const jwt = await token.toJwt();

    return NextResponse.json({
      token: jwt,
      roomName,
      url: LIVEKIT_URL,
      participantIdentity,
      participantName,
    });
  } catch (error) {
    console.error("[livekit/token] Error generating token:", error);
    return NextResponse.json(
      { error: "生成 token 失败，请稍后重试" },
      { status: 500 },
    );
  }
}
