// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { DashboardHeader } from "./dashboard-header";

const { replace, refresh, clearUserInfo, signOut, toastError } = vi.hoisted(
  () => ({
    replace: vi.fn(),
    refresh: vi.fn(),
    clearUserInfo: vi.fn(),
    signOut: vi.fn(),
    toastError: vi.fn(),
  }),
);

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
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
  useRouter: () => ({
    replace,
    refresh,
  }),
}));

vi.mock("@/store/user", () => ({
  useUserStore: () => ({
    userInfo: {
      nickname: "梁爽",
      avatar_url: "",
    },
    clearUserInfo,
  }),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: {
      signOut,
    },
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastError,
  },
}));

describe("DashboardHeader", () => {
  it("confirms before signing out and then redirects to sign-in immediately", async () => {
    signOut.mockResolvedValue({ error: null });

    render(React.createElement(DashboardHeader));

    fireEvent.click(screen.getByRole("button", { name: "logout" }));

    expect(signOut).not.toHaveBeenCalled();
    expect(await screen.findByText("确认退出登录")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "确认退出" }));

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledWith({ scope: "local" });
      expect(clearUserInfo).toHaveBeenCalled();
      expect(replace).toHaveBeenCalledWith("/auth/sign-in");
      expect(refresh).toHaveBeenCalled();
    });
  });
});
