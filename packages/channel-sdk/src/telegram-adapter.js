import { degradeOutboundMessage, supportsFeature } from "./channel-adapter";
const TELEGRAM_CAPABILITIES = {
  supportsCards: false,
  supportsVoice: true,
  supportsRichText: true,
};
export class TelegramAdapter {
  constructor() {
    this.channel = "telegram";
  }
  verifyWebhook() {
    return true;
  }
  parseInboundEvent(input) {
    var _a, _b, _c;
    const payload = JSON.parse(input.body);
    const message = (_a = payload.message) !== null && _a !== void 0 ? _a : {};
    const from = (_b = message.from) !== null && _b !== void 0 ? _b : {};
    const chat = (_c = message.chat) !== null && _c !== void 0 ? _c : {};
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
  async sendMessage(message) {
    const output = degradeOutboundMessage(message, TELEGRAM_CAPABILITIES);
    console.log("[gateway][telegram] send", output.text);
  }
  async editMessage(messageId, message) {
    const output = degradeOutboundMessage(message, TELEGRAM_CAPABILITIES);
    console.log("[gateway][telegram] edit", messageId, output.text);
  }
  supports(feature) {
    return supportsFeature(TELEGRAM_CAPABILITIES, feature);
  }
}
