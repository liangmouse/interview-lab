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
export declare function supportsFeature(capabilities: ChannelCapabilities, feature: "cards" | "voice" | "richText"): boolean;
export declare function degradeOutboundMessage(message: OutboundMessage, capabilities: ChannelCapabilities): OutboundMessage;
