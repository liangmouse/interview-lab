// @vitest-environment jsdom

import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NextIntlClientProvider } from "next-intl";
import { renderToString } from "react-dom/server";
import { ResumeReviewResults } from "../resume-review-results";

vi.stubGlobal("React", React);
vi.stubGlobal(
  "ResizeObserver",
  class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
);

const messages = {
  dashboard: {
    resumeReview: {
      result: {
        overallScore: "综合评分",
        overallAssessment: "总体评价",
        layoutTitle: "版式可读性",
        layoutSummary: "版式总结",
        layoutSuggestions: "版式优化建议",
        strengths: "优势",
        weaknesses: "待改进",
        before: "原文",
        after: "建议修改为",
        reason: "修改原因",
        atsTitle: "ATS 兼容性",
        jdMatchTitle: "JD 匹配度",
        matchedKeywords: "已匹配关键词",
        missingKeywords: "缺失关键词",
      },
    },
  },
};

describe("ResumeReviewResults", () => {
  it("renders layout review when provided", () => {
    const html = renderToString(
      React.createElement(
        NextIntlClientProvider,
        { locale: "zh-CN", messages, timeZone: "Asia/Shanghai" },
        React.createElement(ResumeReviewResults, {
          result: {
            id: "review-1",
            resumeName: "resume.pdf",
            createdAt: new Date().toISOString(),
            overallScore: 82,
            overallAssessment: "内容和表达基础较好。",
            sections: [],
            layoutReview: {
              score: 76,
              summary: "整体层级清晰，但首屏偏挤。",
              strengths: ["模块边界明确"],
              issues: ["个人信息区过于集中"],
              suggestions: ["缩短顶部描述，给经历区更多留白"],
            },
            atsCompatibility: {
              score: 70,
              issues: [],
              recommendations: [],
            },
          },
        }),
      ),
    );

    expect(html).toContain("版式可读性");
    expect(html).toContain("版式总结");
    expect(html).toContain("整体层级清晰，但首屏偏挤。");
    expect(html).toContain("缩短顶部描述，给经历区更多留白");
  });

  it("shows ATS compatibility tooltip copy on hover", async () => {
    const user = userEvent.setup();

    render(
      React.createElement(
        NextIntlClientProvider,
        { locale: "zh-CN", messages, timeZone: "Asia/Shanghai" },
        React.createElement(ResumeReviewResults, {
          result: {
            id: "review-1",
            resumeName: "resume.pdf",
            createdAt: new Date().toISOString(),
            overallScore: 82,
            overallAssessment: "内容和表达基础较好。",
            sections: [],
            layoutReview: {
              score: 76,
              summary: "整体层级清晰，但首屏偏挤。",
              strengths: ["模块边界明确"],
              issues: ["个人信息区过于集中"],
              suggestions: ["缩短顶部描述，给经历区更多留白"],
            },
            atsCompatibility: {
              score: 70,
              issues: [],
              recommendations: [],
            },
          },
        }),
      ),
    );

    await user.hover(screen.getByRole("button", { name: "ATS 兼容性说明" }));

    expect(
      (
        await screen.findAllByText(
          "你的简历对企业招聘系统 ATS（Applicant Tracking System，申请人跟踪系统）的“可读取、可解析、可检索”程度。",
        )
      ).length,
    ).toBeGreaterThan(0);
  });
});
