export type TurnMode = "manual" | "vad";

type UserTranscriptionCallback = (text: string, isFinal: boolean) => void;

type UserTranscriptionRef = {
  current?: UserTranscriptionCallback;
};

export function emitUserTranscription(args: {
  onUserTranscriptionRef: UserTranscriptionRef;
  text: string;
  isFinal: boolean;
}) {
  const { onUserTranscriptionRef, text, isFinal } = args;
  onUserTranscriptionRef.current?.(text, isFinal);
}
