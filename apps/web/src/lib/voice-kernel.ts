export type VoiceKernel = "legacy" | "stepfun-realtime";

type SearchParamsLike = Pick<URLSearchParams, "toString">;

export const VOICE_KERNEL_QUERY_PARAM = "voiceKernel";
export const VOICE_KERNEL_STORAGE_KEY = "interview-voice-kernel";
export const DEFAULT_VOICE_KERNEL: VoiceKernel = "stepfun-realtime";

export function normalizeVoiceKernel(
  value: string | string[] | null | undefined,
): VoiceKernel {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (normalized === "legacy") return "legacy";
  if (normalized === "stepfun-realtime") return "stepfun-realtime";
  // 兼容旧实验链接与 localStorage，把 volc-realtime 迁移到 stepfun-realtime
  return "stepfun-realtime";
}

export function resolveVoiceKernelFromSearchParams(
  searchParams?: Record<string, string | string[] | undefined> | null,
): VoiceKernel {
  if (!searchParams) return DEFAULT_VOICE_KERNEL;
  return normalizeVoiceKernel(searchParams[VOICE_KERNEL_QUERY_PARAM]);
}

export function buildInterviewHref(
  interviewId: string,
  voiceKernel: VoiceKernel,
): string {
  const params = new URLSearchParams();
  params.set(VOICE_KERNEL_QUERY_PARAM, voiceKernel);
  return `/interview/${interviewId}?${params.toString()}`;
}

export function buildVoiceKernelHref(
  pathname: string,
  voiceKernel: VoiceKernel,
  searchParams: SearchParamsLike,
): string {
  const nextParams = new URLSearchParams(searchParams.toString());
  nextParams.set(VOICE_KERNEL_QUERY_PARAM, voiceKernel);
  return `${pathname}?${nextParams.toString()}`;
}

export function readStoredVoiceKernel(): VoiceKernel {
  if (typeof window === "undefined") return DEFAULT_VOICE_KERNEL;
  const stored = window.localStorage.getItem(VOICE_KERNEL_STORAGE_KEY);
  return normalizeVoiceKernel(stored);
}

export function writeStoredVoiceKernel(voiceKernel: VoiceKernel) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VOICE_KERNEL_STORAGE_KEY, voiceKernel);
}
