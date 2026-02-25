import React from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InterviewRoom } from "./interview-room";

vi.stubGlobal("React", React);

vi.mock("next-intl", () => ({
  useLocale: () => "zh-CN",
}));

vi.mock("./ai-interviewer-panel", () => ({
  AIInterviewerPanel: () => null,
}));

vi.mock("./code-workbench", () => ({
  CodeWorkbench: () => null,
}));

vi.mock("./interview-resume-panel", () => ({
  InterviewResumePanel: () => null,
}));

vi.mock("./interview-header", () => ({
  InterviewHeader: (props: unknown) => {
    headerProps = props as Record<string, unknown>;
    return null;
  },
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizableHandle: () => null,
  ResizablePanel: ({ children }: { children?: React.ReactNode }) => children,
  ResizablePanelGroup: ({ children }: { children?: React.ReactNode }) =>
    children,
}));

vi.mock("@/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    isSupported: true,
    transcript: "",
    interimTranscript: "",
    startListening: vi.fn(),
    stopListening: vi.fn(),
    resetTranscript: vi.fn(),
  }),
}));

vi.mock("@/hooks/useLiveKitRoom", () => ({
  useLiveKitRoom: () => ({
    isConnected: false,
    isConnecting: false,
    isMicEnabled: false,
    isAgentSpeaking: false,
    isUserSpeaking: false,
    transcript: [],
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    toggleMicrophone: vi.fn(),
    sendRpc: vi.fn(),
    sendTextMessage: vi.fn(),
  }),
}));

vi.mock("@/store/user", () => ({
  useUserStore: (
    selector?: (state: { userInfo: { resume_url: string } }) => unknown,
  ) => {
    const state = {
      userInfo: {
        resume_url: "https://example.com/resume.pdf",
      },
    };
    return selector ? selector(state) : state;
  },
}));

let headerProps: Record<string, unknown> | null = null;

describe("InterviewRoom", () => {
  beforeEach(() => {
    headerProps = null;
  });

  it("renders without accessing isAgentSpeaking before initialization", () => {
    expect(() =>
      renderToString(React.createElement(InterviewRoom, { interviewId: "1" })),
    ).not.toThrow();
  });

  it("opens resume panel by default when resume url exists", () => {
    renderToString(React.createElement(InterviewRoom, { interviewId: "1" }));
    expect(headerProps?.isResumePanelOpen).toBe(true);
  });
});
