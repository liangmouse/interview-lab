// @vitest-environment jsdom

import React from "react";
import { fireEvent, render } from "@testing-library/react";
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

vi.mock("./voice-first-panel", () => ({
  VoiceFirstPanel: () => null,
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

vi.mock("@/hooks/useInterviewVoiceRuntime", () => ({
  useInterviewVoiceRuntime: () => ({
    voiceKernel: "stepfun-realtime",
    isConnected: true,
    isConnecting: false,
    isMicEnabled: true,
    isAgentSpeaking: false,
    isUserSpeaking: false,
    isAudioPlaybackBlocked: false,
    transcript: [],
    error: null,
    connect: vi.fn(),
    disconnect: vi.fn(),
    toggleMicrophone: vi.fn(),
    beginPushToTalk: mockBeginPushToTalk,
    endPushToTalk: mockEndPushToTalk,
    startInterview: vi.fn(),
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
const mockBeginPushToTalk = vi.fn();
const mockEndPushToTalk = vi.fn();

describe("InterviewRoom", () => {
  beforeEach(() => {
    headerProps = null;
    mockBeginPushToTalk.mockReset();
    mockEndPushToTalk.mockReset();
  });

  it("renders without accessing isAgentSpeaking before initialization", () => {
    expect(() =>
      renderToString(
        React.createElement(InterviewRoom, {
          interviewId: "1",
          initialVoiceKernel: "legacy",
        }),
      ),
    ).not.toThrow();
  });

  it("opens resume panel by default when resume url exists", () => {
    renderToString(
      React.createElement(InterviewRoom, {
        interviewId: "1",
        initialVoiceKernel: "legacy",
      }),
    );
    expect(headerProps?.isResumePanelOpen).toBe(true);
  });

  it("starts and ends push-to-talk when holding space in voice-first mode", () => {
    render(
      React.createElement(InterviewRoom, {
        interviewId: "1",
        initialVoiceKernel: "stepfun-realtime",
      }),
    );

    fireEvent.keyDown(window, { code: "Space" });
    fireEvent.keyUp(window, { code: "Space" });

    expect(mockBeginPushToTalk).toHaveBeenCalledTimes(1);
    expect(mockEndPushToTalk).toHaveBeenCalledTimes(1);
  });
});
