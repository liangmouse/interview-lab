import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AIInterviewerPanel } from "./ai-interviewer-panel";

vi.stubGlobal("React", React);

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({
    resolvedTheme: "light",
  }),
}));

vi.mock("./transcript-stream", () => ({
  TranscriptStream: () => null,
}));

vi.mock("./control-dock", () => ({
  ControlDock: () => null,
}));

vi.mock("@/components/agents-ui/agent-audio-visualizer-aura", () => ({
  AgentAudioVisualizerAura: () => null,
}));

describe("AIInterviewerPanel", () => {
  const baseProps = {
    turnMode: "manual" as const,
    isConnected: true,
    isConnecting: false,
    isMicEnabled: true,
    isAgentSpeaking: false,
    agentState: "listening" as const,
    isUserSpeaking: false,
    isAudioPlaybackBlocked: false,
    transcript: [],
    onMicToggle: vi.fn(),
    manualDraftText: "",
    onSendMessage: vi.fn(),
  };

  it("shows audio unblock hint when browser blocks playback", () => {
    const html = renderToString(
      React.createElement(AIInterviewerPanel, {
        ...baseProps,
        isAudioPlaybackBlocked: true,
      }),
    );

    expect(html).toContain(
      "浏览器拦截了语音播放，请点击页面任意位置开启音频。",
    );
  });
});
