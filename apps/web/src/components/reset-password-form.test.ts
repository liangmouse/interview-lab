// @vitest-environment jsdom

import React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ResetPasswordForm } from "@/components/reset-password-form";

vi.stubGlobal("React", React);

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getSession: vi.fn(),
  signOut: vi.fn(),
  toastSuccess: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      getSession: mocks.getSession,
      signOut: mocks.signOut,
      updateUser: mocks.updateUser,
    },
  }),
}));

vi.mock("@/i18n/navigation", async () => {
  const React = await import("react");

  return {
    Link: ({
      href,
      children,
      className,
    }: {
      href: string;
      children: React.ReactNode;
      className?: string;
    }) =>
      React.createElement(
        "a",
        {
          href,
          className,
        },
        children,
      ),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: mocks.toastSuccess,
  },
}));

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  mocks.exchangeCodeForSession.mockReset();
  mocks.getSession.mockReset();
  mocks.signOut.mockReset();
  mocks.toastSuccess.mockReset();
  mocks.updateUser.mockReset();
});

describe("ResetPasswordForm", () => {
  it("exchanges the recovery code and updates the password", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password?code=recovery-code",
    );
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getSession.mockResolvedValue({
      data: { session: { user: {} } },
      error: null,
    });
    mocks.updateUser.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });

    render(React.createElement(ResetPasswordForm));

    expect(await screen.findByText("设置新密码")).not.toBeNull();
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("recovery-code");

    fireEvent.change(screen.getByLabelText("新密码"), {
      target: { value: "new-password" },
    });
    fireEvent.change(screen.getByLabelText("确认新密码"), {
      target: { value: "new-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新密码" }));

    await waitFor(() => {
      expect(mocks.updateUser).toHaveBeenCalledWith({
        password: "new-password",
      });
    });
    expect(mocks.signOut).toHaveBeenCalled();
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "密码已更新，请使用新密码登录",
    );
    expect(await screen.findByText("密码已更新")).not.toBeNull();
  });

  it("shows a mismatch error before updating", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password?code=recovery-code",
    );
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getSession.mockResolvedValue({
      data: { session: { user: {} } },
      error: null,
    });

    render(React.createElement(ResetPasswordForm));

    expect(await screen.findByText("设置新密码")).not.toBeNull();
    fireEvent.change(screen.getByLabelText("新密码"), {
      target: { value: "new-password" },
    });
    fireEvent.change(screen.getByLabelText("确认新密码"), {
      target: { value: "other-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "更新密码" }));

    expect(screen.getByText("两次输入的密码不一致")).not.toBeNull();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("shows an expired link state from the URL hash", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password#error=access_denied&error_code=otp_expired",
    );

    render(React.createElement(ResetPasswordForm));

    expect(await screen.findByText("链接不可用")).not.toBeNull();
    expect(
      screen.getByText("重置链接无效或已过期，请重新发送重置邮件。"),
    ).not.toBeNull();
    expect(
      screen
        .getByRole("link", { name: "重新发送重置邮件" })
        .getAttribute("href"),
    ).toBe("/forgot-password");
  });

  it("shows an error when there is no recovery session", async () => {
    window.history.replaceState(
      {},
      "",
      "/auth/reset-password?code=recovery-code",
    );
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    render(React.createElement(ResetPasswordForm));

    expect(await screen.findByText("链接不可用")).not.toBeNull();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects a normal signed-in session without a recovery link", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: {} } },
      error: null,
    });

    render(React.createElement(ResetPasswordForm));

    expect(await screen.findByText("链接不可用")).not.toBeNull();
    expect(screen.queryByText("设置新密码")).toBeNull();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });
});
