import type {
  ChannelAdapter,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from "./channel-adapter";
import { degradeOutboundMessage, supportsFeature } from "./channel-adapter";

const TELEGRAM_CAPABILITIES: ChannelCapabilities = {
  supportsCards: false,
  supportsVoice: true,
  supportsRichText: true,
};

export class TelegramAdapter implements ChannelAdapter {
  readonly channel = "telegram" as const;

  verifyWebhook() {
    return true;
  }

  parseInboundEvent(input: { body: string }): InboundMessage | null {
    const payload = JSON.parse(input.body) as Record<string, unknown>;
    const message = (payload.message ?? {}) as Record<string, unknown>;
    const from = (message.from ?? {}) as Record<string, unknown>;
    const chat = (message.chat ?? {}) as Record<string, unknown>;

    if (typeof chat.id !== "number" || typeof from.id !== "number") {
      return null;
    }

    return {
      channel: "telegram",
      externalUserId: String(from.id),
      threadKey: String(chat.id),
      text: typeof message.text === "string" ? message.text : "",
      rawEvent: payload,
    };
  }

  async sendMessage(message: OutboundMessage) {
    const output = degradeOutboundMessage(message, TELEGRAM_CAPABILITIES);
    console.log("[gateway][telegram] send", output.text);
  }

  async editMessage(messageId: string, message: OutboundMessage) {
    const output = degradeOutboundMessage(message, TELEGRAM_CAPABILITIES);
    console.log("[gateway][telegram] edit", messageId, output.text);
  }

  supports(feature: "cards" | "voice" | "richText") {
    return supportsFeature(TELEGRAM_CAPABILITIES, feature);
  }
}
