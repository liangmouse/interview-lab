import { NextResponse } from "next/server";
import { listResumeVersionsForUser } from "@interviewclaw/data-access";
import { getCurrentUser } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  try {
    const versions = await listResumeVersionsForUser(user.id, 20);
    return NextResponse.json({ data: versions });
  } catch (error) {
    console.error("Failed to list resume versions:", error);
    return NextResponse.json(
      { error: "简历版本加载失败，请稍后重试" },
      { status: 500 },
    );
  }
}
