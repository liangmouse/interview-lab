import { NextRequest, NextResponse } from "next/server";
import {
  createQuestioningJob,
  listQuestioningJobsForUser,
  upsertResumeRecord,
} from "@interviewclaw/data-access";
import { getCurrentUser } from "@/lib/auth";
import { resolveUserAccessForUserId } from "@/lib/billing/access";
import { createClient } from "@/lib/supabase/server";

function isTransientFetchFailure(error: unknown) {
  return error instanceof Error && error.message.includes("fetch failed");
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const supabase = await createClient();

  try {
    const jobs = await listQuestioningJobsForUser(user.id, 20, supabase);
    return NextResponse.json({ data: jobs });
  } catch (error) {
    console.error("Failed to list questioning jobs:", error);

    if (isTransientFetchFailure(error)) {
      return NextResponse.json({
        data: [],
        warning: "押题记录暂时加载失败，请稍后刷新重试",
      });
    }

    return NextResponse.json(
      { error: "押题记录加载失败，请稍后重试" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const supabase = await createClient();
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

  const access = await resolveUserAccessForUserId(user.id, supabase);
  let consumedTrial = false;

  try {
    if (access.tier !== "premium") {
      const { data: trialResult, error: trialError } = await supabase.rpc(
        "consume_trial_if_available",
        {
          p_user_id: user.id,
        },
      );

      if (trialError) {
        console.error("Error consuming questioning trial:", trialError);
        return NextResponse.json(
          { error: "校验押题次数失败，请稍后重试" },
          { status: 500 },
        );
      }

      if (!trialResult?.allowed) {
        return NextResponse.json(
          { error: "押题次数已用完，请升级会员后继续" },
          { status: 403 },
        );
      }

      consumedTrial = true;
    }

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
      consumedTrial,
    });

    return NextResponse.json({ data: job }, { status: 201 });
  } catch (error) {
    console.error("Failed to create questioning job:", error);

    if (consumedTrial) {
      const { error: compensateError } = await supabase.rpc(
        "compensate_trial_consumption",
        {
          p_user_id: user.id,
        },
      );

      if (compensateError) {
        console.error(
          "Failed to compensate questioning trial consumption:",
          compensateError,
        );
      }
    }

    return NextResponse.json(
      { error: "押题任务创建失败，请稍后重试" },
      { status: 500 },
    );
  }
}
