import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserAccessForUserId } from "@/lib/billing/access";
import {
  analyzeJobDescription,
  parseJobDescriptionInput,
} from "@/lib/jd-analysis";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const access = await resolveUserAccessForUserId(user.id, supabase);
  if (!access.canUsePersonalization) {
    return NextResponse.json(
      { error: "岗位定制面试为会员功能，请先升级" },
      { status: 403 },
    );
  }

  const { data, error } = await supabase
    .from("job_descriptions")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  const access = await resolveUserAccessForUserId(user.id, supabase);
  if (!access.canUsePersonalization) {
    return NextResponse.json(
      { error: "岗位定制面试为会员功能，请先升级" },
      { status: 403 },
    );
  }

  const contentType = request.headers.get("content-type") || "";
  let title: string | null = null;
  let text: string | undefined;
  let file: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    title = (formData.get("title") as string | null) || null;
    text = (formData.get("text") as string | null) || undefined;
    file = (formData.get("file") as File | null) || null;
  } else {
    const body = await request.json();
    title = body.title || null;
    text = body.text;
  }

  const parsed = await parseJobDescriptionInput({ text, file });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const analyzed = await analyzeJobDescription(parsed.text);
  if (!analyzed.success) {
    return NextResponse.json({ error: analyzed.error }, { status: 500 });
  }

  const payload = {
    user_id: user.id,
    title: title || analyzed.data.title || "未命名岗位",
    source_type: parsed.sourceType,
    raw_text: parsed.text,
    summary: analyzed.data.summary || null,
    experience_level: analyzed.data.experienceLevel || null,
    keywords: analyzed.data.keywords || [],
    requirements: analyzed.data.requirements || [],
    responsibilities: analyzed.data.responsibilities || [],
  };

  const { data, error } = await supabase
    .from("job_descriptions")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
