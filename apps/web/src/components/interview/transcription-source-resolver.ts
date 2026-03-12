interface ResolveDraftTextFromSourcesArgs {
  livekitText: string;
  livekitUpdatedAt: number | null;
  browserText: string;
  now: number;
  livekitPriorityWindowMs?: number;
  browserFallbackEnabled?: boolean;
}

const DEFAULT_LIVEKIT_PRIORITY_WINDOW_MS = 2000;

export function resolveDraftTextFromSources(
  args: ResolveDraftTextFromSourcesArgs,
) {
  const {
    livekitText,
    livekitUpdatedAt,
    browserText,
    now,
    livekitPriorityWindowMs = DEFAULT_LIVEKIT_PRIORITY_WINDOW_MS,
    browserFallbackEnabled = true,
  } = args;

  const hasLivekitText = livekitText.trim().length > 0;
  const hasBrowserText = browserText.trim().length > 0;

  if (hasLivekitText && livekitUpdatedAt !== null) {
    const isLivekitFresh = now - livekitUpdatedAt <= livekitPriorityWindowMs;
    if (isLivekitFresh) return livekitText;
  }

  if (browserFallbackEnabled && hasBrowserText) return browserText;
  return livekitText;
}
