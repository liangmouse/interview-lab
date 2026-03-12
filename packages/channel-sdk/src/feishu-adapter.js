import { degradeOutboundMessage, supportsFeature } from "./channel-adapter";
const FEISHU_CAPABILITIES = {
  supportsCards: true,
  supportsVoice: false,
  supportsRichText: true,
};
export class FeishuAdapter {
  constructor() {
    this.channel = "feishu";
  }
  verifyWebhook() {
    return true;
  }
  parseInboundEvent(input) {
    var _a, _b, _c;
    const payload = JSON.parse(input.body);
    const event = (_a = payload.event) !== null && _a !== void 0 ? _a : {};
    const sender = (_b = event.sender) !== null && _b !== void 0 ? _b : {};
    const message = (_c = event.message) !== null && _c !== void 0 ? _c : {};
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
  async sendMessage(message) {
    const output = degradeOutboundMessage(message, FEISHU_CAPABILITIES);
    console.log("[gateway][feishu] send", output.text);
  }
  async editMessage(messageId, message) {
    const output = degradeOutboundMessage(message, FEISHU_CAPABILITIES);
    console.log("[gateway][feishu] edit", messageId, output.text);
  }
  supports(feature) {
    return supportsFeature(FEISHU_CAPABILITIES, feature);
  }
}
