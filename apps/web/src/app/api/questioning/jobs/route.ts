import { NextRequest, NextResponse } from "next/server";
import {
  createQuestioningJob,
  listQuestioningJobsForUser,
  upsertResumeRecord,
} from "@interviewclaw/data-access";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const jobs = await listQuestioningJobsForUser(user.id, 20, supabase);
  return NextResponse.json({ data: jobs });
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const body = await request.json();
  const resumeStoragePath = String(
    body.resumeId || body.resumeStoragePath || "",
  ).trim();
  const targetRole = String(body.targetRole || "").trim();
  const track = body.track === "campus" ? "campus" : "social";
  const workExperience = String(body.workExperience || "").trim();
  const targetCompany = String(body.targetCompany || "").trim();
  const jobDescription = String(body.jobDescription || "").trim();

  console.info("[api/questioning/jobs] create request received", {
    userId: user.id,
    resumeStoragePath,
    targetRole,
    track,
    hasWorkExperience: !!workExperience,
    hasTargetCompany: !!targetCompany,
    hasJobDescription: !!jobDescription,
  });

  if (!resumeStoragePath || !resumeStoragePath.startsWith(`${user.id}/`)) {
    return NextResponse.json({ error: "请选择有效简历" }, { status: 400 });
  }

  if (!targetRole) {
    return NextResponse.json({ error: "请填写目标岗位" }, { status: 400 });
  }

  if (track === "social" && !workExperience) {
    return NextResponse.json(
      { error: "社招模式需要选择工作年限" },
      { status: 400 },
    );
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("resumes").getPublicUrl(resumeStoragePath);

  await upsertResumeRecord(
    {
      userId: user.id,
      storagePath: resumeStoragePath,
      fileUrl: publicUrl,
      fileName: resumeStoragePath.split("/").pop() || "resume.pdf",
      processingStatus: "uploaded",
    },
    supabase,
  );

  const job = await createQuestioningJob(
    {
      userId: user.id,
      payload: {
        resumeStoragePath,
        targetRole,
        track,
        ...(workExperience ? { workExperience } : {}),
        ...(targetCompany ? { targetCompany } : {}),
        ...(jobDescription ? { jobDescription } : {}),
      },
    },
    supabase,
  );

  console.info("[api/questioning/jobs] create request completed", {
    userId: user.id,
    jobId: job.id,
    status: job.status,
    durationMs: Date.now() - startedAt,
  });

  return NextResponse.json({ data: job }, { status: 201 });
}
