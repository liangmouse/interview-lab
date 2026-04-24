import { NextResponse } from "next/server";
import { getResumeGenerationJobForUser } from "@interviewclaw/data-access";
import { getCurrentUser } from "@/lib/auth";

interface ResumeGenerationJobRouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: Request,
  { params }: ResumeGenerationJobRouteProps,
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const { id } = await params;
  const job = await getResumeGenerationJobForUser(id, user.id);
  if (!job) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  return NextResponse.json({ data: job });
}
