import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { QuestioningCenterPanel } from "./questioning-center-panel";

const {
  getResumeLibrary,
  createQuestioningJob,
  getQuestioningJob,
  listQuestioningJobs,
} = vi.hoisted(() => ({
  getResumeLibrary: vi.fn(),
  createQuestioningJob: vi.fn(),
  getQuestioningJob: vi.fn(),
  listQuestioningJobs: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return {
    ...actual,
    Sparkles: () => <span>sparkles</span>,
  };
});

vi.mock("@/action/get-resume-library", () => ({
  getResumeLibrary,
}));

vi.mock("@/lib/llm-jobs-client", () => ({
  createQuestioningJob,
  getQuestioningJob,
  listQuestioningJobs,
}));

describe("QuestioningCenterPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getResumeLibrary.mockResolvedValue([
      {
        id: "resume-1",
        filePath: "user-1/resume.pdf",
        defaultName: "resume.pdf",
        uploadedAt: "2026-03-24T00:00:00.000Z",
      },
    ]);
    listQuestioningJobs.mockResolvedValue({
      jobs: [
        {
          id: "job-1",
          userId: "user-1",
          status: "queued",
          payload: {
            resumeStoragePath: "user-1/resume.pdf",
            targetRole: "前端工程师",
            track: "social",
          },
          attemptCount: 1,
          availableAt: "2026-03-24T00:05:00.000Z",
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
    });
    getQuestioningJob.mockResolvedValue({
      id: "job-1",
      userId: "user-1",
      status: "queued",
      payload: {
        resumeStoragePath: "user-1/resume.pdf",
        targetRole: "前端工程师",
        track: "social",
      },
      attemptCount: 1,
      availableAt: "2026-03-24T00:05:00.000Z",
      createdAt: "2026-03-24T00:00:00.000Z",
      updatedAt: "2026-03-24T00:00:00.000Z",
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access: {
            tier: "free",
            trialRemaining: 1,
          },
        }),
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps generate button enabled when there is a pending job", async () => {
    render(<QuestioningCenterPanel />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "form.generate" }),
      ).toBeEnabled();
    });

    expect(
      screen.getByText(
        "上一个任务生成失败，正在等待系统自动重试，您仍可继续提交新的押题任务。",
      ),
    ).toBeInTheDocument();
  });

  it("disables generation and shows recharge prompt when trial remaining is 0", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          access: {
            tier: "free",
            trialRemaining: 0,
          },
        }),
      }),
    );

    render(<QuestioningCenterPanel />);

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "押题次数已用完" }),
      ).toBeDisabled();
    });

    expect(
      screen.getByText("押题次数已用完，请前往", { exact: false }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "会员中心" })).toHaveAttribute(
      "href",
      "/dashboard/profile",
    );
  });

  it("shows the transient list warning instead of silently treating it as empty", async () => {
    listQuestioningJobs.mockResolvedValueOnce({
      jobs: [],
      warning: "押题记录暂时加载失败，请稍后刷新重试",
    });

    render(<QuestioningCenterPanel />);

    await waitFor(() => {
      expect(
        screen.getByText("押题记录暂时加载失败，请稍后刷新重试"),
      ).toBeInTheDocument();
    });
  });

  it("polls every pending job instead of only the latest one", async () => {
    vi.useFakeTimers();
    listQuestioningJobs.mockResolvedValueOnce({
      jobs: [
        {
          id: "job-2",
          userId: "user-1",
          status: "running",
          payload: {
            resumeStoragePath: "user-1/resume.pdf",
            targetRole: "前端工程师",
            track: "social",
          },
          attemptCount: 0,
          availableAt: "2026-03-24T00:05:00.000Z",
          createdAt: "2026-03-24T00:01:00.000Z",
          updatedAt: "2026-03-24T00:01:00.000Z",
          startedAt: "2026-03-24T00:01:30.000Z",
        },
        {
          id: "job-1",
          userId: "user-1",
          status: "queued",
          payload: {
            resumeStoragePath: "user-1/resume.pdf",
            targetRole: "前端工程师",
            track: "social",
          },
          attemptCount: 1,
          availableAt: "2026-03-24T00:05:00.000Z",
          createdAt: "2026-03-24T00:00:00.000Z",
          updatedAt: "2026-03-24T00:00:00.000Z",
        },
      ],
    });
    getQuestioningJob
      .mockResolvedValueOnce({
        id: "job-2",
        userId: "user-1",
        status: "running",
        payload: {
          resumeStoragePath: "user-1/resume.pdf",
          targetRole: "前端工程师",
          track: "social",
        },
        attemptCount: 0,
        availableAt: "2026-03-24T00:05:00.000Z",
        createdAt: "2026-03-24T00:01:00.000Z",
        updatedAt: "2026-03-24T00:01:00.000Z",
        startedAt: "2026-03-24T00:01:30.000Z",
      })
      .mockResolvedValueOnce({
        id: "job-1",
        userId: "user-1",
        status: "queued",
        payload: {
          resumeStoragePath: "user-1/resume.pdf",
          targetRole: "前端工程师",
          track: "social",
        },
        attemptCount: 1,
        availableAt: "2026-03-24T00:05:00.000Z",
        createdAt: "2026-03-24T00:00:00.000Z",
        updatedAt: "2026-03-24T00:00:00.000Z",
      });

    render(<QuestioningCenterPanel />);

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    await vi.advanceTimersByTimeAsync(6000);
    await Promise.resolve();

    expect(getQuestioningJob).toHaveBeenCalledTimes(2);
    expect(getQuestioningJob).toHaveBeenCalledWith("job-2");
    expect(getQuestioningJob).toHaveBeenCalledWith("job-1");
  });
});
