import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockLoadInterviewMessages } = vi.hoisted(() => ({
  mockLoadInterviewMessages: vi.fn(),
}));

vi.mock("@interviewclaw/data-access", async () => {
  const actual = await vi.importActual<
    typeof import("@interviewclaw/data-access")
  >("@interviewclaw/data-access");
  return {
    ...actual,
    interviewDataAccess: {
      loadInterviewMessages: mockLoadInterviewMessages,
    },
  };
});

import { generateDynamicInterviewOpening } from "./interview-rag-service";

describe("generateDynamicInterviewOpening", () => {
  beforeEach(() => {
    mockLoadInterviewMessages.mockReset();
    mockLoadInterviewMessages.mockResolvedValue([]);
  });

  it("uses a spoken self-introduction opening when the interview has no user speech yet", async () => {
    const result = await generateDynamicInterviewOpening({
      interviewId: "interview-1",
      profile: {
        job_intention: "前端开发",
      },
    });

    expect(result.decision.questionText).toBe(
      "你好，欢迎参加今天的前端开发面试。先请你做一个简短的自我介绍，重点说说最近做过的项目和你负责的部分。",
    );
    expect(result.question.questionText).toBe(result.decision.questionText);
  });
});
