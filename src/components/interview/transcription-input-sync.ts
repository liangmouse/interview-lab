interface ResolveInputTextFromTranscriptionArgs {
  currentInputText: string;
  transcriptionText: string;
  hasEditedCurrentTurn: boolean;
}

export function resolveInputTextFromTranscription(
  args: ResolveInputTextFromTranscriptionArgs,
) {
  const { currentInputText, transcriptionText, hasEditedCurrentTurn } = args;
  if (hasEditedCurrentTurn) return currentInputText;
  return transcriptionText;
}
