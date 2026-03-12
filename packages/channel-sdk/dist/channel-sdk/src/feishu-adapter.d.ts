import type { ChannelAdapter, InboundMessage, OutboundMessage } from "./channel-adapter";
export declare class FeishuAdapter implements ChannelAdapter {
    readonly channel: "feishu";
    verifyWebhook(): boolean;
    parseInboundEvent(input: {
        body: string;
    }): InboundMessage | null;
    sendMessage(message: OutboundMessage): Promise<void>;
    editMessage(messageId: string, message: OutboundMessage): Promise<void>;
    supports(feature: "cards" | "voice" | "richText"): boolean;
}
