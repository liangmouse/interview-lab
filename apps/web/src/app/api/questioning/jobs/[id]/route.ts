import { NextResponse } from "next/server";
import { getQuestioningJobForUser } from "@interviewclaw/data-access";
import { createClient } from "@/lib/supabase/server";

interface QuestioningJobRouteProps {
  params: Promise<{ id: string }>;
}

export async function GET(
  _request: Request,
  { params }: QuestioningJobRouteProps,
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const { id } = await params;
  const job = await getQuestioningJobForUser(id, user.id, supabase);

  if (!job) {
    return NextResponse.json({ error: "任务不存在" }, { status: 404 });
  }

  return NextResponse.json({ data: job });
}
