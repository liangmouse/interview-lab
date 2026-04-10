// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CodingInterviewRoom } from "./coding-interview-room";

afterEach(() => {
  cleanup();
});

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

vi.mock("./code-editor", () => ({
  CodeEditor: ({
    files,
    activeTab,
    onChange,
  }: {
    files: Record<string, string>;
    activeTab: string;
    onChange: (tab: "solution" | "test", value: string) => void;
  }) =>
    React.createElement("textarea", {
      "aria-label": "代码编辑器",
      value: files[activeTab],
      onChange: (event: React.ChangeEvent<HTMLTextAreaElement>) =>
        onChange(activeTab as "solution" | "test", event.target.value),
    }),
}));

const problems = [
  {
    id: "problem-1",
    title: "两数之和",
    description: "描述一",
    difficulty: "easy" as const,
    language: "javascript" as const,
    sourceKind: "leetcode" as const,
    examples: [{ input: "1,2", output: "3" }],
    constraints: ["约束 1"],
    solutionTemplate: "function one() {}",
    testTemplate: "test one",
  },
  {
    id: "problem-2",
    title: "手写事件总线",
    description: "描述二",
    difficulty: "medium" as const,
    language: "javascript" as const,
    sourceKind: "resume" as const,
    examples: [{ input: "a", output: "b" }],
    constraints: ["约束 2"],
    solutionTemplate: "function two() {}",
    testTemplate: "test two",
  },
  {
    id: "problem-3",
    title: "合并区间",
    description: "描述三",
    difficulty: "hard" as const,
    language: "javascript" as const,
    sourceKind: "leetcode" as const,
    examples: [{ input: "x", output: "y" }],
    constraints: ["约束 3"],
    solutionTemplate: "function three() {}",
    testTemplate: "test three",
  },
];

describe("CodingInterviewRoom", () => {
  it("switches problems from top previous and next controls", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(CodingInterviewRoom, {
        interviewId: "interview-1",
        problems,
      }),
    );

    expect(
      screen.getByRole("heading", { name: "两数之和" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上一题" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "下一题" }));

    expect(
      screen.getByRole("heading", { name: "手写事件总线" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "下一题" }));

    expect(
      screen.getByRole("heading", { name: "合并区间" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一题" })).toBeDisabled();
  });

  it("opens the drawer and switches problems from the list", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(CodingInterviewRoom, {
        interviewId: "interview-1",
        problems,
      }),
    );

    await user.click(screen.getByRole("button", { name: "打开题目列表" }));

    expect(
      screen.getByRole("heading", { name: "题目列表" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /第 2 题/i }));

    expect(document.body).toHaveTextContent("手写事件总线");
  });

  it("preserves solution code per problem after switching", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(CodingInterviewRoom, {
        interviewId: "interview-1",
        problems,
      }),
    );

    const editor = screen.getByRole("textbox", { name: "代码编辑器" });
    await user.clear(editor);
    await user.type(editor, "first-solution");

    await user.click(screen.getByRole("button", { name: "下一题" }));

    const secondEditor = screen.getByRole("textbox", { name: "代码编辑器" });
    await user.clear(secondEditor);
    await user.type(secondEditor, "second-solution");

    await user.click(screen.getByRole("button", { name: "上一题" }));
    expect(screen.getByRole("textbox", { name: "代码编辑器" })).toHaveValue(
      "first-solution",
    );

    await user.click(screen.getByRole("button", { name: "下一题" }));
    expect(screen.getByRole("textbox", { name: "代码编辑器" })).toHaveValue(
      "second-solution",
    );
  });
});
