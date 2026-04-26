import React from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { InterviewHeader } from "./interview-header";

vi.stubGlobal("React", React);

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      connecting: "Connecting...",
      connectionFailed: "Connection failed",
      connected: "Connected",
      disconnected: "Disconnected",
      timeElapsed: "Time Elapsed",
      showResumePanel: "Show Resume",
      hideResumePanel: "Hide Resume",
    };
    return messages[key] ?? key;
  },
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    children,
    href,
    className,
  }: {
    children: React.ReactNode;
    href: string;
    className?: string;
  }) => React.createElement("a", { href, className }, children),
}));

describe("InterviewHeader", () => {
  it("does not render disconnected status by default", () => {
    const html = renderToString(React.createElement(InterviewHeader));

    expect(html).not.toContain("Disconnected");
  });

  it("renders show resume label when resume panel is closed", () => {
    const html = renderToString(
      React.createElement(InterviewHeader, {
        isResumePanelOpen: false,
        onToggleResumePanel: () => undefined,
      }),
    );

    expect(html).toContain("Show Resume");
  });

  it("renders hide resume label when resume panel is open", () => {
    const html = renderToString(
      React.createElement(InterviewHeader, {
        isResumePanelOpen: true,
        onToggleResumePanel: () => undefined,
      }),
    );

    expect(html).toContain("Hide Resume");
  });
});
