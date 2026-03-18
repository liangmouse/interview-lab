import { NextRequest, NextResponse } from "next/server";
import { ingestQuestionAssets } from "@interviewclaw/data-access";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "未登录或登录已过期" },
        { status: 401 },
      );
    }

    const body = await request.json();
    const assets = Array.isArray(body.assets) ? body.assets : [];

    if (assets.length === 0) {
      return NextResponse.json({ error: "缺少 assets" }, { status: 400 });
    }

    const created = await ingestQuestionAssets(assets);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "知识导入失败" },
      { status: 500 },
    );
  }
}
