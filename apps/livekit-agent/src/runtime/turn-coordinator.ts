import { voice, llm } from "@livekit/agents";

const DEFAULT_TURN_DEBOUNCE_MS = 1200;
const DEFAULT_VOICE_ACTIVITY_WINDOW_MS = 4000;

function mergeTranscriptText(existing: string, incoming: string): string {
  const trimmedExisting = existing.trim();
  const trimmedIncoming = incoming.trim();

  if (!trimmedIncoming) return existing;
  if (!trimmedExisting) return trimmedIncoming;
  if (trimmedIncoming === trimmedExisting) return existing;
  if (trimmedIncoming.startsWith(trimmedExisting)) return trimmedIncoming;
  if (trimmedExisting.endsWith(trimmedIncoming)) return trimmedExisting;
  return `${trimmedExisting} ${trimmedIncoming}`;
}

type TurnCoordinatorOptions = {
  debounceMs?: number;
  voiceActivityWindowMs?: number;
};

export class TurnCoordinator {
  private readonly session: voice.AgentSession;
  private readonly debounceMs: number;
  private readonly voiceActivityWindowMs: number;
  private pendingSegments: string[] = [];
  private pendingUserMessageIds = new Set<string>();
  private flushTimer: NodeJS.Timeout | null = null;
  private lastVoiceInputAt = 0;
  private bufferActive = false;
  private allowNextUserMessagePassthrough = false;
  private expectMergedUserMessage = false;

  constructor(
    session: voice.AgentSession,
    options: TurnCoordinatorOptions = {},
  ) {
    this.session = session;
    this.debounceMs = options.debounceMs ?? DEFAULT_TURN_DEBOUNCE_MS;
    this.voiceActivityWindowMs =
      options.voiceActivityWindowMs ?? DEFAULT_VOICE_ACTIVITY_WINDOW_MS;
  }

  markVoiceActivity() {
    this.lastVoiceInputAt = Date.now();
  }

  markManualTextInput() {
    if (this.bufferActive) {
      this.flush();
    }
    this.allowNextUserMessagePassthrough = true;
  }

  handleUserTurnEnd(text: string) {
    const trimmed = text.trim();
    if (!trimmed) return;
    this.bufferActive = true;
    this.pendingSegments.push(trimmed);
    this.scheduleFlush();
  }

  shouldPublishUserMessage(item: llm.ChatMessage): boolean {
    if (this.expectMergedUserMessage) {
      this.expectMergedUserMessage = false;
      return true;
    }

    if (this.allowNextUserMessagePassthrough) {
      this.allowNextUserMessagePassthrough = false;
      return true;
    }

    const now = Date.now();
    const voiceActive =
      this.bufferActive ||
      now - this.lastVoiceInputAt <= this.voiceActivityWindowMs;

    if (voiceActive) {
      this.pendingUserMessageIds.add(item.id);
      return false;
    }

    return true;
  }

  private scheduleFlush() {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = setTimeout(() => this.flush(), this.debounceMs);
  }

  private flush() {
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }

    if (this.pendingUserMessageIds.size > 0) {
      const history = this.session.history;
      history.items = history.items.filter((item) => {
        if (item.type !== "message") return true;
        if (item.role !== "user") return true;
        return !this.pendingUserMessageIds.has(item.id);
      });
    }

    const merged = this.pendingSegments.reduce(mergeTranscriptText, "");
    this.resetBuffer();

    if (!merged.trim()) {
      return;
    }

    this.expectMergedUserMessage = true;
    this.session.generateReply({
      userInput: merged,
      allowInterruptions: false,
    });
  }

  private resetBuffer() {
    this.pendingSegments = [];
    this.pendingUserMessageIds.clear();
    this.bufferActive = false;
  }
}
