// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthTabs } from "@/components/auth-tabs";

vi.stubGlobal("React", React);

const replace = vi.fn();
const useSearchParamsMock = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => useSearchParamsMock(),
}));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => "/auth/sign-in",
  useRouter: () => ({
    replace,
  }),
}));

afterEach(() => {
  cleanup();
  replace.mockReset();
  useSearchParamsMock.mockReset();
});

describe("AuthTabs", () => {
  it("renders the register view when tab=sign-up", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams("tab=sign-up"));

    render(
      React.createElement(AuthTabs, {
        initialTab: "sign-in",
        signInLabel: "登录",
        signUpLabel: "注册",
        signInContent: React.createElement("div", null, "登录表单"),
        signUpContent: React.createElement("div", null, "注册表单"),
      }),
    );

    expect(screen.getByText("注册表单")).not.toBeNull();
    expect(screen.queryByText("登录表单")).toBeNull();
  });

  it("updates the query string when switching tabs", () => {
    useSearchParamsMock.mockReturnValue(
      new URLSearchParams("foo=1&tab=sign-in"),
    );

    render(
      React.createElement(AuthTabs, {
        initialTab: "sign-in",
        signInLabel: "登录",
        signUpLabel: "注册",
        signInContent: React.createElement("div", null, "登录表单"),
        signUpContent: React.createElement("div", null, "注册表单"),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "注册" }));

    expect(replace).toHaveBeenCalledWith("/auth/sign-in?foo=1&tab=sign-up");
  });
});
