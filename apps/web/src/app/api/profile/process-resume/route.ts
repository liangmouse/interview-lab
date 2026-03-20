import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processResumeFromStorage } from "@/lib/resume-processing-service";

interface ProcessResumeRequestBody {
  storagePath?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const body = (await request.json()) as ProcessResumeRequestBody;
    if (!body.storagePath) {
      return NextResponse.json({ error: "缺少 storagePath" }, { status: 400 });
    }

    const result = await processResumeFromStorage(user.id, body.storagePath);

    return NextResponse.json(
      {
        success: result.success,
        error: result.error,
        resumeProcessingStatus: result.success ? "completed" : "failed",
      },
      { status: result.success ? 200 : 500 },
    );
  } catch (error) {
    console.error("Process resume API error:", error);
    return NextResponse.json(
      { error: "服务器内部错误", resumeProcessingStatus: "failed" },
      { status: 500 },
    );
  }
}
