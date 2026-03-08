import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolveUserAccessForUserId } from "@/lib/billing/access";
import { analyzeJobDescription } from "@/lib/jd-analysis";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
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
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  return NextResponse.json({ data });
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
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

  const body = await request.json();
  const nextText = typeof body.raw_text === "string" ? body.raw_text : null;

  const updatePayload: Record<string, unknown> = {
    title: body.title,
    updated_at: new Date().toISOString(),
  };

  if (nextText && nextText.trim()) {
    const analyzed = await analyzeJobDescription(nextText);
    if (!analyzed.success) {
      return NextResponse.json({ error: analyzed.error }, { status: 500 });
    }

    updatePayload.raw_text = nextText.trim();
    updatePayload.summary = analyzed.data.summary || null;
    updatePayload.experience_level = analyzed.data.experienceLevel || null;
    updatePayload.keywords = analyzed.data.keywords || [];
    updatePayload.requirements = analyzed.data.requirements || [];
    updatePayload.responsibilities = analyzed.data.responsibilities || [];
  }

  Object.keys(updatePayload).forEach((key) => {
    const val = updatePayload[key];
    if (val === undefined) delete updatePayload[key];
  });

  const { data, error } = await supabase
    .from("job_descriptions")
    .update(updatePayload)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(
  _request: NextRequest,
  { params }: RouteParams,
) {
  const { id } = await params;
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

  const { error } = await supabase
    .from("job_descriptions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
