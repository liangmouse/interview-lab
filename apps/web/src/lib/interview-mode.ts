export type InterviewMode = "full" | "focus";
type SearchParamsLike = Pick<URLSearchParams, "toString">;

export function normalizeInterviewMode(
  mode: string | string[] | null | undefined,
): InterviewMode {
  const value = Array.isArray(mode) ? mode[0] : mode;
  return value === "focus" ? "focus" : "full";
}

export function buildInterviewModeHref(
  pathname: string,
  mode: InterviewMode,
  searchParams: SearchParamsLike,
): string {
  const nextParams = new URLSearchParams(searchParams.toString());
  nextParams.set("mode", mode);
  return `${pathname}?${nextParams.toString()}`;
}
