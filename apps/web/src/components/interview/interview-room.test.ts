// @vitest-environment jsdom

import React from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InterviewRoom } from "./interview-room";

vi.stubGlobal("React", React);

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("./realtime-interview-panel", () => ({
  RealtimeInterviewPanel: (props: unknown) => {
    realtimePanelProps = props as Record<string, unknown>;
    return React.createElement("div", null, "RealtimeInterviewPanel");
  },
}));

vi.mock("./interview-resume-panel", () => ({
  InterviewResumePanel: () => React.createElement("div", null, "Resume"),
}));

vi.mock("./interview-header", () => ({
  InterviewHeader: (props: unknown) => {
    headerProps = props as Record<string, unknown>;
    return React.createElement("div", null, "Header");
  },
}));

vi.mock("@/components/ui/resizable", () => ({
  ResizableHandle: () => null,
  ResizablePanel: ({ children }: { children?: React.ReactNode }) => children,
  ResizablePanelGroup: ({ children }: { children?: React.ReactNode }) =>
    children,
}));

vi.mock("@/store/user", () => ({
  useUserStore: (
    selector?: (state: { userInfo: { resume_url: string } }) => unknown,
  ) => {
    const state = {
      userInfo: {
        resume_url: "https://example.com/resume.pdf",
      },
    };
    return selector ? selector(state) : state;
  },
}));

let headerProps: Record<string, unknown> | null = null;
let realtimePanelProps: Record<string, unknown> | null = null;

describe("InterviewRoom", () => {
  beforeEach(() => {
    headerProps = null;
    realtimePanelProps = null;
  });

  it("renders the realtime voice panel without legacy runtime props", () => {
    expect(() =>
      renderToString(
        React.createElement(InterviewRoom, {
          interviewId: "1",
          interviewType: "后端开发:intermediate",
          duration: "25",
          candidateContext: {
            jobIntention: "后端工程师",
            companyIntention: "AI 公司",
            skills: ["Java", "Redis"],
            hasResume: true,
            projectExperiences: [
              {
                title: "秒杀系统",
                description: "负责库存一致性和削峰",
              },
            ],
          },
          interviewPlan: {
            summary: "后端中级面试计划",
            plannedTopics: ["缓存", "并发"],
            questions: [
              {
                questionText: "讲一下 Redis 缓存击穿怎么处理？",
                topics: ["缓存"],
                expectedSignals: ["互斥锁", "逻辑过期"],
              },
            ],
          },
        }),
      ),
    ).not.toThrow();

    expect(realtimePanelProps?.interviewId).toBe("1");
    expect(realtimePanelProps?.title).toBe("综合面试");
    expect(String(realtimePanelProps?.systemRole)).toContain(
      "岗位方向：后端工程师",
    );
    expect(String(realtimePanelProps?.systemRole)).toContain("难度：中级");
    expect(String(realtimePanelProps?.systemRole)).toContain("秒杀系统");
    expect(String(realtimePanelProps?.systemRole)).toContain("Redis 缓存击穿");
  });

  it("opens resume panel by default when resume url exists", () => {
    renderToString(
      React.createElement(InterviewRoom, {
        interviewId: "1",
        interviewType: "前端开发:beginner",
      }),
    );

    expect(headerProps?.isResumePanelOpen).toBe(true);
    expect(typeof headerProps?.onToggleResumePanel).toBe("function");
  });
});
