// @vitest-environment jsdom

import React from "react";
import { cleanup, render, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodingInterviewSession } from "./coding-interview-session";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) =>
    React.createElement("button", props, children),
}));

vi.mock("@/components/ui/skeleton", () => ({
  Skeleton: (props: React.HTMLAttributes<HTMLDivElement>) =>
    React.createElement("div", props),
}));

vi.mock("./coding-interview-room", () => ({
  CodingInterviewRoom: () => React.createElement("div", null, "coding-room"),
}));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  replaceMock.mockReset();
});

describe("CodingInterviewSession", () => {
  it("redirects to dashboard interview page when interview is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ error: "面试不存在" }),
      }),
    );

    render(
      React.createElement(CodingInterviewSession, { interviewId: "missing" }),
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/interview");
    });
  });

  it("redirects to dashboard interview page when coding session is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 409,
        json: vi.fn().mockResolvedValue({
          error: "编码面试状态不可用",
          redirectTo: "/interview",
        }),
      }),
    );

    render(
      React.createElement(CodingInterviewSession, { interviewId: "broken" }),
    );

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith("/interview");
    });
  });
});
