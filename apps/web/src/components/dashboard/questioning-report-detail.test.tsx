import React from "react";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it } from "vitest";
import { QuestioningReportDetail } from "./questioning-report-detail";

describe("QuestioningReportDetail", () => {
  it("renders a wider structured layout and keeps long content wrapped", () => {
    const longHighlight =
      "TypeScript 高级类型是核心考点：重点准备条件类型、infer、映射类型、模板字面量类型，以及如何把这些能力落到真实 SDK API 设计里。";
    const longQuestion =
      "请你详细讲讲在一个复杂 Agent 项目里，如何把 Planner、Executor、Memory、Tool Use、流式输出、重试恢复和权限控制串成稳定可观测的一条链路？";
    const longReferenceAnswer =
      "回答时先说明业务背景，再拆职责边界、关键设计决策、失败案例、监控指标与最终结果，确保每一段都能落到具体实现细节和真实取舍。";

    render(
      <QuestioningReportDetail
        report={{
          id: "report-1",
          title: "agent 开发押题报告",
          targetRole: "Agent 开发工程师",
          track: "campus",
          createdAt: "2026-03-24T09:17:00.000Z",
          summary:
            "这份报告围绕工程化 Agent 项目经验、类型系统能力和系统设计表达来组织题单，优先帮你补足最容易被面试官深挖的内容。",
          highlights: [longHighlight],
          questions: [
            {
              questionId: "q-1",
              questionType: "system_design",
              questionText: longQuestion,
              topics: ["Agent 架构", "流式输出", "可观测性"],
              expectedSignals: ["职责边界清晰", "能说明取舍", "能举失败案例"],
              reason: "系统设计与真实项目拆解能力",
              preparationAdvice: "优先按背景、架构、难点、结果四段来准备。",
              category: "系统设计",
              answerGuide:
                "用 STAR 讲背景和目标，再补系统边界、故障恢复、监控指标与最终结果。",
              referenceAnswer: longReferenceAnswer,
              followUps: [
                "如果 Tool 调用超时和模型幻觉同时出现，你会怎样隔离定位？",
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText("高优先准备维度")).toBeInTheDocument();
    expect(screen.getByText("逐题准备清单")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "TypeScript 高级类型" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "这份报告围绕工程化 Agent 项目经验、类型系统能力和系统设计表达来组织题单，优先帮你补足最容易被面试官深挖的内容。",
      ),
    ).toBeInTheDocument();

    expect(screen.queryByText(longHighlight)).not.toBeInTheDocument();

    const highlightBody = screen.getByText(
      "重点准备条件类型、infer、映射类型、模板字面量类型，以及如何把这些能力落到真实 SDK API 设计里。",
    );
    expect(highlightBody).toHaveClass("whitespace-normal");
    expect(highlightBody).toHaveClass("break-words");
    expect(highlightBody.closest("article")).toHaveClass("min-w-0");

    const questionHeading = screen.getByRole("heading", { name: longQuestion });
    expect(questionHeading).toHaveClass("whitespace-normal");
    expect(questionHeading).toHaveClass("break-words");

    const referenceAnswer = screen.getByText(longReferenceAnswer);
    expect(referenceAnswer).toHaveClass("break-words");
  });
});
