export function supportsFeature(capabilities, feature) {
  switch (feature) {
    case "cards":
      return capabilities.supportsCards;
    case "voice":
      return capabilities.supportsVoice;
    case "richText":
      return capabilities.supportsRichText;
  }
}
export function degradeOutboundMessage(message, capabilities) {
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
