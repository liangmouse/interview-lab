const DEFAULT_TURN_DEBOUNCE_MS = 1200;
const DEFAULT_VOICE_ACTIVITY_WINDOW_MS = 4000;
function mergeTranscriptText(existing, incoming) {
    const trimmedExisting = existing.trim();
    const trimmedIncoming = incoming.trim();
    if (!trimmedIncoming)
        return existing;
    if (!trimmedExisting)
        return trimmedIncoming;
    if (trimmedIncoming === trimmedExisting)
        return existing;
    if (trimmedIncoming.startsWith(trimmedExisting))
        return trimmedIncoming;
    if (trimmedExisting.endsWith(trimmedIncoming))
        return trimmedExisting;
    return `${trimmedExisting} ${trimmedIncoming}`;
}
export class TurnCoordinator {
    constructor(session, options = {}) {
        var _a, _b;
        this.pendingSegments = [];
        this.pendingUserMessageIds = new Set();
        this.flushTimer = null;
        this.lastVoiceInputAt = 0;
        this.bufferActive = false;
        this.allowNextUserMessagePassthrough = false;
        this.expectMergedUserMessage = false;
        this.session = session;
        this.debounceMs = (_a = options.debounceMs) !== null && _a !== void 0 ? _a : DEFAULT_TURN_DEBOUNCE_MS;
        this.voiceActivityWindowMs =
            (_b = options.voiceActivityWindowMs) !== null && _b !== void 0 ? _b : DEFAULT_VOICE_ACTIVITY_WINDOW_MS;
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
    handleUserTurnEnd(text) {
        const trimmed = text.trim();
        if (!trimmed)
            return;
        this.bufferActive = true;
        this.pendingSegments.push(trimmed);
        this.scheduleFlush();
    }
    shouldPublishUserMessage(item) {
        if (this.expectMergedUserMessage) {
            this.expectMergedUserMessage = false;
            return true;
        }
        if (this.allowNextUserMessagePassthrough) {
            this.allowNextUserMessagePassthrough = false;
            return true;
        }
        const now = Date.now();
        const voiceActive = this.bufferActive ||
            now - this.lastVoiceInputAt <= this.voiceActivityWindowMs;
        if (voiceActive) {
            this.pendingUserMessageIds.add(item.id);
            return false;
        }
        return true;
    }
    scheduleFlush() {
        if (this.flushTimer)
            clearTimeout(this.flushTimer);
        this.flushTimer = setTimeout(() => this.flush(), this.debounceMs);
    }
    flush() {
        if (this.flushTimer) {
            clearTimeout(this.flushTimer);
            this.flushTimer = null;
        }
        if (this.pendingUserMessageIds.size > 0) {
            const history = this.session.history;
            history.items = history.items.filter((item) => {
                if (item.type !== "message")
                    return true;
                if (item.role !== "user")
                    return true;
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
    resetBuffer() {
        this.pendingSegments = [];
        this.pendingUserMessageIds.clear();
        this.bufferActive = false;
    }
}
