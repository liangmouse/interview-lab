import { FeishuAdapter, TelegramAdapter, } from "@interviewclaw/channel-sdk";
import { SessionRouter } from "@interviewclaw/domain";
import { WorkflowEngine } from "@interviewclaw/workflows";
export class ChannelGateway {
    constructor() {
        this.router = new SessionRouter();
        this.workflowEngine = new WorkflowEngine();
        this.adapters = {
            feishu: new FeishuAdapter(),
            telegram: new TelegramAdapter(),
        };
    }
    async handleWebhook(event) {
        const adapter = this.adapters[event.channel];
        if (!adapter) {
            throw new Error(`Unsupported channel: ${event.channel}`);
        }
        const verified = await adapter.verifyWebhook({
            headers: event.headers,
            body: event.body,
        });
        if (!verified) {
            return { accepted: false, reason: "invalid_signature" };
        }
        const inbound = await adapter.parseInboundEvent({
            body: event.body,
            headers: event.headers,
        });
        if (!inbound) {
            return { accepted: false, reason: "ignored" };
        }
        const session = this.router.route({
            userId: inbound.externalUserId,
            channel: inbound.channel,
            threadKey: inbound.threadKey,
        });
        const plannedTask = this.workflowEngine.schedule({
            dedupeKey: `${inbound.channel}:${inbound.threadKey}:${inbound.text}`,
            capability: "study_planner",
            trigger: "event",
            payload: {
                sessionId: session.id,
                text: inbound.text,
            },
        });
        return {
            accepted: true,
            session,
            plannedTask,
        };
    }
}
if (process.env.NODE_ENV !== "test") {
    console.log("[gateway] InterviewClaw gateway ready");
}
