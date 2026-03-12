import type { ChannelKind } from "@interviewclaw/domain";

export type ChannelCapabilities = {
  supportsCards: boolean;
  supportsVoice: boolean;
  supportsRichText: boolean;
};

export type InboundMessage = {
  channel: ChannelKind;
  externalUserId: string;
  threadKey: string;
  text: string;
  rawEvent: Record<string, unknown>;
};

export type OutboundMessage = {
  text: string;
  card?: {
    title: string;
    body: string;
  };
  voice?: {
    text: string;
  };
};

export type ChannelAdapter = {
  channel: ChannelKind;
  verifyWebhook(input: {
    headers: Headers | Record<string, string | string[] | undefined>;
    body: string;
  }): Promise<boolean> | boolean;
  parseInboundEvent(input: {
    body: string;
    headers: Headers | Record<string, string | string[] | undefined>;
  }): Promise<InboundMessage | null> | InboundMessage | null;
  sendMessage(message: OutboundMessage): Promise<void>;
  editMessage(messageId: string, message: OutboundMessage): Promise<void>;
  supports(feature: "cards" | "voice" | "richText"): boolean;
};

export function supportsFeature(
  capabilities: ChannelCapabilities,
  feature: "cards" | "voice" | "richText",
) {
  switch (feature) {
    case "cards":
      return capabilities.supportsCards;
    case "voice":
      return capabilities.supportsVoice;
    case "richText":
      return capabilities.supportsRichText;
  }
}

export function degradeOutboundMessage(
  message: OutboundMessage,
  capabilities: ChannelCapabilities,
): OutboundMessage {
  const lines = [message.text];

  if (message.card && !capabilities.supportsCards) {
    lines.push(`${message.card.title}\n${message.card.body}`);
  }

  if (message.voice && !capabilities.supportsVoice) {
    lines.push(message.voice.text);
  }

  return {
    text: lines.filter(Boolean).join("\n\n"),
    card: capabilities.supportsCards ? message.card : undefined,
    voice: capabilities.supportsVoice ? message.voice : undefined,
  };
}
