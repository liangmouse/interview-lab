export const ClientEventId = {
  StartConnection: 1,
  FinishConnection: 2,
  StartSession: 100,
  FinishSession: 102,
  TaskRequest: 200,
  SayHello: 300,
  ChatTTSText: 500,
  ChatTextQuery: 501,
} as const;

export const ServerEventId = {
  ConnectionStarted: 50,
  ConnectionFailed: 51,
  ConnectionFinished: 52,
  SessionStarted: 150,
  SessionFinished: 152,
  SessionFailed: 153,
  TTSSentenceStart: 350,
  TTSResponse: 352,
  TTSSentenceEnd: 351,
  TTSEnded: 359,
  ASRInfo: 450,
  ASRResponse: 451,
  ASREnded: 459,
  ChatResponse: 550,
  ChatEnded: 559,
} as const;

export type ClientEventName = keyof typeof ClientEventId;
export type ServerEventName = keyof typeof ServerEventId;

const SESSION_LEVEL_EVENTS = new Set<number>([
  ClientEventId.StartSession,
  ClientEventId.FinishSession,
  ClientEventId.TaskRequest,
  ClientEventId.SayHello,
  ClientEventId.ChatTTSText,
  ClientEventId.ChatTextQuery,
]);

export function isSessionLevelEvent(eventId: number): boolean {
  return SESSION_LEVEL_EVENTS.has(eventId);
}
