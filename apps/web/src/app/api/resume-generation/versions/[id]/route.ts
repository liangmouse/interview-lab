import { NextResponse } from "next/server";
import { getResumeVersionForUser } from "@interviewclaw/data-access";
import { getCurrentUser } from "@/lib/auth";

interface ResumeVersionRouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: Request,
  { params }: ResumeVersionRouteProps,
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const { id } = await params;
  const version = await getResumeVersionForUser(id, user.id);
  if (!version) {
    return NextResponse.json({ error: "版本不存在" }, { status: 404 });
  }

  return NextResponse.json({ data: version });
}
