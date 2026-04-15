import type { VoiceKernel } from "@/lib/voice-kernel";

export interface TranscriptItem {
  id: string;
  role: "user" | "agent";
  text: string;
  timestamp: number;
  isFinal: boolean;
}

export interface InterviewVoiceRuntimeState {
  connectionState: string;
  isConnected: boolean;
  isConnecting: boolean;
  isMicEnabled: boolean;
  isAgentSpeaking: boolean;
  isUserSpeaking: boolean;
  isAudioPlaybackBlocked: boolean;
  transcript: TranscriptItem[];
  error: string | null;
}

export interface InterviewVoiceRuntimeOptions {
  interviewId: string;
  voiceKernel: VoiceKernel;
  enabled?: boolean;
  onUserTranscription?: (text: string, isFinal: boolean) => void;
  onDataMessage?: (message: Record<string, unknown>) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

export interface InterviewVoiceRuntime extends InterviewVoiceRuntimeState {
  voiceKernel: VoiceKernel;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleMicrophone: () => Promise<void>;
  beginPushToTalk?: () => Promise<void>;
  endPushToTalk?: () => Promise<void>;
  startInterview: (args?: { turnMode?: "manual" | "vad" }) => Promise<void>;
  sendTextMessage: (text: string) => Promise<void>;
}
