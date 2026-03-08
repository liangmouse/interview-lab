import { NextResponse } from "next/server";
import { getCurrentUserAccess } from "@/lib/billing/access";
import { BILLING_PLANS } from "@/lib/billing/config";

export async function GET() {
  const access = await getCurrentUserAccess();

  if (!access) {
    return NextResponse.json({ error: "未登录或登录已过期" }, { status: 401 });
  }

  return NextResponse.json({
    access,
    plans: BILLING_PLANS,
  });
}
