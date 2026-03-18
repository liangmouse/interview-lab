import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    success: true,
    mode: "noop",
    message:
      "v1 暂未实现独立重建索引任务，当前题库读取走结构化字段与全文检索。",
  });
}
