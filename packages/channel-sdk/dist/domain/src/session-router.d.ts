import type { ChannelKind, ConversationSession } from "./types";
type RouteInput = {
    userId: string;
    channel: ChannelKind;
    threadKey: string;
};
export declare class SessionRouter {
    private readonly sessions;
    route(input: RouteInput): ConversationSession;
    list(): ConversationSession[];
}
export {};
