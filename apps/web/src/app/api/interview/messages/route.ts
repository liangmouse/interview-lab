import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getRequiredSupabaseAdminEnv } from "@/lib/supabase/env";

function createSupabaseAdminClient() {
  const { url, key } = getRequiredSupabaseAdminEnv();
  return createClient(url, key);
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const interviewId = searchParams.get("interviewId");

    if (!interviewId) {
      return NextResponse.json(
        { error: "Missing interviewId" },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("interview_id", interviewId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("Error fetching messages:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ messages: data });
  } catch (error) {
    console.error("Internal Error fetching messages:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { interviewId, role, content } = body;
    const normalizedContent =
      typeof content === "string"
        ? content.trim()
        : String(content ?? "").trim();

    if (!interviewId || !role || !normalizedContent) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    if (role !== "user" && role !== "assistant") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.rpc(
      role === "user" ? "add_user_message" : "add_ai_message",
      {
        p_interview_id: interviewId,
        p_content: normalizedContent,
      },
    );

    if (error) {
      console.error("Error saving message:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Internal Error saving message:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 },
    );
  }
}
