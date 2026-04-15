// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FullInterviewPanel } from "./full-interview-panel";

vi.stubGlobal("React", React);

afterEach(() => {
  cleanup();
});

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const messages: Record<string, string> = {
      fullInterviewDesc: "模拟真实面试流程",
    };
    return messages[key] ?? key;
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock("@/action/create-interview", () => ({
  createInterview: vi.fn(),
}));

vi.mock("@/lib/voice-kernel", () => ({
  buildInterviewHref: vi.fn(),
  readStoredVoiceKernel: vi.fn(),
}));

describe("FullInterviewPanel", () => {
  it("filters topic options and selects a suggested role", () => {
    render(React.createElement(FullInterviewPanel));

    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    fireEvent.change(screen.getByPlaceholderText("搜索岗位方向"), {
      target: { value: "产品" },
    });

    fireEvent.click(screen.getByRole("button", { name: "产品经理" }));

    expect(trigger.textContent).toContain("产品经理");
    expect(screen.queryByPlaceholderText("搜索岗位方向")).toBe(null);
  });

  it("allows committing a custom topic from the search box", () => {
    render(React.createElement(FullInterviewPanel));

    const trigger = screen.getByRole("combobox");
    fireEvent.click(trigger);

    fireEvent.change(screen.getByPlaceholderText("搜索岗位方向"), {
      target: { value: "增长产品经理" },
    });

    fireEvent.click(
      screen.getByRole("button", { name: "使用 “增长产品经理”" }),
    );

    expect(trigger.textContent).toContain("增长产品经理");
  });
});
