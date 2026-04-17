// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { JobRecommendationPanel } from "./job-recommendation-panel";

const {
  createAutoJobRecommendation,
  createManualJobRecommendation,
  deleteBossSession,
  getBossSession,
  getJobRecommendationJob,
  listJobRecommendationJobs,
  saveBossSession,
  upsertJobRecommendationFeedback,
  useUserStore,
} = vi.hoisted(() => ({
  createAutoJobRecommendation: vi.fn(),
  createManualJobRecommendation: vi.fn(),
  deleteBossSession: vi.fn(),
  getBossSession: vi.fn(),
  getJobRecommendationJob: vi.fn(),
  listJobRecommendationJobs: vi.fn(),
  saveBossSession: vi.fn(),
  upsertJobRecommendationFeedback: vi.fn(),
  useUserStore: vi.fn(),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/store/user", () => ({
  useUserStore,
}));

vi.mock("@/lib/job-recommendations-client", () => ({
  createAutoJobRecommendation,
  createManualJobRecommendation,
  deleteBossSession,
  getBossSession,
  getJobRecommendationJob,
  listJobRecommendationJobs,
  saveBossSession,
  upsertJobRecommendationFeedback,
}));

function buildSucceededJob() {
  return {
    id: "job-1",
    userId: "user-1",
    status: "succeeded",
    payload: {
      mode: "auto",
      source: "boss",
    },
    result: {
      id: "result-1",
      mode: "auto",
      source: "boss",
      createdAt: "2026-04-17T00:00:00.000Z",
      inferredQuery: {
        cities: ["上海"],
        salaryRange: {
          minK: 25,
          maxK: 35,
        },
        role: "前端工程师",
        industries: ["AI 应用"],
        companySizes: ["100-499人"],
        reasoning: ["结合简历和已保存偏好生成筛选条件。"],
      },
      summary: "推荐结果更偏向成长型 AI 团队。",
      jobs: [
        {
          sourceJobId: "boss-job-1",
          title: "前端工程师",
          companyName: "某科技",
          city: "上海",
          salaryText: "25-35K",
          industry: "AI 应用",
          companySize: "100-499人",
          experience: "3-5年",
          degree: "本科",
          tags: ["React"],
          url: "https://example.com/job/1",
          matchScore: 92,
          matchReasons: ["技能栈高度匹配"],
          cautions: [],
        },
      ],
    },
    attemptCount: 0,
    availableAt: "2026-04-17T00:00:00.000Z",
    createdAt: "2026-04-17T00:00:00.000Z",
    updatedAt: "2026-04-17T00:00:00.000Z",
    completedAt: "2026-04-17T00:00:00.000Z",
  };
}

describe("JobRecommendationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useUserStore.mockReturnValue({
      userInfo: {
        job_intention: "前端工程师",
        company_intention: "AI 公司",
        experience_years: 4,
        skills: ["React", "TypeScript", "Next.js"],
      },
    });
    getBossSession.mockResolvedValue({
      id: "session-1",
      userId: "user-1",
      source: "boss",
      status: "connected",
      lastValidatedAt: "2026-04-17T00:00:00.000Z",
      createdAt: "2026-04-17T00:00:00.000Z",
      updatedAt: "2026-04-17T00:00:00.000Z",
    });
    listJobRecommendationJobs.mockResolvedValue([buildSucceededJob()]);
    createManualJobRecommendation.mockResolvedValue(buildSucceededJob());
    createAutoJobRecommendation.mockResolvedValue(buildSucceededJob());
    upsertJobRecommendationFeedback.mockResolvedValue({
      id: "feedback-1",
      userId: "user-1",
      source: "boss",
      sourceJobId: "boss-job-1",
      action: "hidden",
      jobSnapshot: buildSucceededJob().result.jobs[0],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("switches between auto and manual tabs", async () => {
    render(<JobRecommendationPanel />);

    await waitFor(() => {
      expect(screen.getByText("BOSS 登录态")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "手动筛选" }));

    expect(screen.getByText("城市")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "开始手动推荐" }),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "自动推荐" }));

    expect(
      screen.getByRole("button", { name: "开始自动推荐" }),
    ).toBeInTheDocument();
  });

  it("validates the manual form before creating a job", async () => {
    render(<JobRecommendationPanel />);

    await waitFor(() => {
      expect(screen.getByText("BOSS 登录态")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("tab", { name: "手动筛选" }));
    fireEvent.click(screen.getByRole("button", { name: "开始手动推荐" }));

    expect(await screen.findByText("请填写岗位")).toBeInTheDocument();
    expect(createManualJobRecommendation).not.toHaveBeenCalled();
  });

  it("shows pending and failed jobs in the status area", async () => {
    listJobRecommendationJobs.mockResolvedValueOnce([
      {
        id: "job-pending-1",
        userId: "user-1",
        status: "queued",
        payload: {
          mode: "auto",
          source: "boss",
        },
        attemptCount: 0,
        availableAt: "2026-04-17T00:00:00.000Z",
        createdAt: "2026-04-17T00:00:00.000Z",
        updatedAt: "2026-04-17T00:00:00.000Z",
      },
      {
        id: "job-failed-1",
        userId: "user-1",
        status: "failed",
        payload: {
          mode: "manual",
          source: "boss",
        },
        errorMessage: "BOSS 登录态已失效",
        attemptCount: 2,
        availableAt: "2026-04-17T00:00:00.000Z",
        createdAt: "2026-04-17T00:00:00.000Z",
        updatedAt: "2026-04-17T00:00:00.000Z",
      },
    ]);

    render(<JobRecommendationPanel />);

    await waitFor(() => {
      expect(screen.getByText("处理中")).toBeInTheDocument();
    });

    expect(screen.getByText(/自动推荐任务正在排队中/)).toBeInTheDocument();
    expect(screen.getByText("失败")).toBeInTheDocument();
    expect(screen.getByText("BOSS 登录态已失效")).toBeInTheDocument();
  });

  it("applies optimistic updates when hiding a recommended job", async () => {
    render(<JobRecommendationPanel />);

    await waitFor(() => {
      expect(screen.getByText("前端工程师")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "屏蔽" }));

    expect(upsertJobRecommendationFeedback).toHaveBeenCalledWith({
      sourceJobId: "boss-job-1",
      action: "hidden",
      jobSnapshot: expect.objectContaining({
        sourceJobId: "boss-job-1",
        title: "前端工程师",
      }),
    });

    await waitFor(() => {
      expect(screen.queryByText("前端工程师")).not.toBeInTheDocument();
    });
  });
});
