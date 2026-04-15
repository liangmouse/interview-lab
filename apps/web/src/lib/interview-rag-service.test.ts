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

  it("uses a fixed self-introduction prompt when the interview has no user speech yet", async () => {
    const result = await generateDynamicInterviewOpening({
      interviewId: "interview-1",
      profile: {
        job_intention: "前端开发",
      },
    });

    expect(result.decision.questionText).toBe(
      "你是前端开发面试场景中的面试官，请友善地引导用户进行自我介绍，简短一些就好。",
    );
    expect(result.question.questionText).toBe(result.decision.questionText);
  });
});
