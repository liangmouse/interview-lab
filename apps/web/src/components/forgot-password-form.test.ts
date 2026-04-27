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
import { ForgotPasswordForm } from "@/components/forgot-password-form";

vi.stubGlobal("React", React);

const mocks = vi.hoisted(() => ({
  resetPasswordForEmail: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: mocks.resetPasswordForEmail,
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
  mocks.resetPasswordForEmail.mockReset();
  mocks.toastSuccess.mockReset();
});

describe("ForgotPasswordForm", () => {
  it("calls Supabase with a normalized email", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });

    render(React.createElement(ForgotPasswordForm));

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "  USER@Example.COM " },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送重置邮件" }));

    await waitFor(() => {
      expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith(
        "user@example.com",
        {
          redirectTo: "http://localhost:3000/auth/reset-password",
        },
      );
    });

    expect(screen.getByText("重置邮件已发送")).not.toBeNull();
    expect(screen.getByText(/user@example.com/)).not.toBeNull();
    expect(
      screen.getByRole("link", { name: "返回登录" }).getAttribute("href"),
    ).toBe("/auth/sign-in");
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "重置邮件已发送，请查看邮箱",
    );
  });

  it("does not submit when email is empty", () => {
    render(React.createElement(ForgotPasswordForm));

    const submitButton = screen.getByRole("button", { name: "发送重置邮件" });
    fireEvent.submit(submitButton.closest("form")!);

    expect(screen.getByText("请输入邮箱")).not.toBeNull();
    expect(mocks.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it("shows Supabase errors", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({
      error: { message: "邮件发送失败" },
    });

    render(React.createElement(ForgotPasswordForm));

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送重置邮件" }));

    expect(await screen.findByText("邮件发送失败")).not.toBeNull();
    expect(screen.queryByText("重置邮件已发送")).toBeNull();
  });

  it("shows a localized rate limit error", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({
      error: { message: "Email rate limit exceeded" },
    });

    render(React.createElement(ForgotPasswordForm));

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送重置邮件" }));

    expect(
      await screen.findByText("重置邮件发送过于频繁，请稍后再试。"),
    ).not.toBeNull();
    expect(screen.queryByText("重置邮件已发送")).toBeNull();
  });

  it("shows the success state and keeps a return link", async () => {
    mocks.resetPasswordForEmail.mockResolvedValue({ error: null });

    render(React.createElement(ForgotPasswordForm));

    fireEvent.change(screen.getByLabelText("邮箱"), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "发送重置邮件" }));

    expect(await screen.findByText("重置邮件已发送")).not.toBeNull();
    expect(screen.getByRole("link", { name: "返回登录" })).not.toBeNull();
  });
});
