"use client";

import { formatDateTime } from "@/lib/format";

export function FormattedDate({ value }: { value: string }) {
  return <span>{formatDateTime(value)}</span>;
}
