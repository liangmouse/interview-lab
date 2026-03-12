import type {
  ChannelAdapter,
  ChannelCapabilities,
  InboundMessage,
  OutboundMessage,
} from "./channel-adapter";
import { degradeOutboundMessage, supportsFeature } from "./channel-adapter";

const FEISHU_CAPABILITIES: ChannelCapabilities = {
  supportsCards: true,
  supportsVoice: false,
  supportsRichText: true,
};

export class FeishuAdapter implements ChannelAdapter {
  readonly channel = "feishu" as const;

  verifyWebhook() {
    return true;
  }

  parseInboundEvent(input: { body: string }): InboundMessage | null {
    const payload = JSON.parse(input.body) as Record<string, unknown>;
    const event = (payload.event ?? {}) as Record<string, unknown>;
    const sender = (event.sender ?? {}) as Record<string, unknown>;
    const message = (event.message ?? {}) as Record<string, unknown>;

    if (
      typeof message.chat_id !== "string" ||
      typeof sender.sender_id !== "string"
    ) {
      return null;
    }

    return {
      channel: "feishu",
      externalUserId: sender.sender_id,
      threadKey: message.chat_id,
      text: typeof message.content === "string" ? message.content : "",
      rawEvent: payload,
    };
  }

  async sendMessage(message: OutboundMessage) {
    const output = degradeOutboundMessage(message, FEISHU_CAPABILITIES);
    console.log("[gateway][feishu] send", output.text);
  }

  async editMessage(messageId: string, message: OutboundMessage) {
    const output = degradeOutboundMessage(message, FEISHU_CAPABILITIES);
    console.log("[gateway][feishu] edit", messageId, output.text);
  }

  supports(feature: "cards" | "voice" | "richText") {
    return supportsFeature(FEISHU_CAPABILITIES, feature);
  }
}
