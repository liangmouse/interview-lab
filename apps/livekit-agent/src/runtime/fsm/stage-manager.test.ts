import { describe, it, expect, vi, beforeEach } from "vitest";
import { StageManager } from "./stage-manager";
import { InterviewStage } from "./types";

describe("StageManager", () => {
  let stageManager: StageManager;

  beforeEach(() => {
    // 10 seconds total for testing
    const totalDuration = 10;
    stageManager = new StageManager(totalDuration, {
      [InterviewStage.INTRO]: { durationRatio: 0.1, weight: 1 }, // 1s
      [InterviewStage.MAIN_TECHNICAL]: { durationRatio: 0.1, weight: 1 }, // 1s
      [InterviewStage.SOFT_SKILLS]: { durationRatio: 0.1, weight: 1 }, // 1s
      [InterviewStage.CLOSING]: { durationRatio: 0.1, weight: 1 }, // 1s
    });
  });

  it("should initialize with INTRO stage", () => {
    expect(stageManager.getCurrentStage()).toBe(InterviewStage.INTRO);
  });

  it("should transition correctly through the flow", () => {
    // Intro -> Technical
    expect(stageManager.transitionToNext()).toBe(InterviewStage.MAIN_TECHNICAL);
    expect(stageManager.getCurrentStage()).toBe(InterviewStage.MAIN_TECHNICAL);

    // Technical -> Soft Skills
    expect(stageManager.transitionToNext()).toBe(InterviewStage.SOFT_SKILLS);
    expect(stageManager.getCurrentStage()).toBe(InterviewStage.SOFT_SKILLS);

    // Soft Skills -> Closing
    expect(stageManager.transitionToNext()).toBe(InterviewStage.CLOSING);
    expect(stageManager.getCurrentStage()).toBe(InterviewStage.CLOSING);

    // Closing -> End (null)
    expect(stageManager.transitionToNext()).toBeNull();
  });

  it("should detect when stage is over time", async () => {
    // Configured for 1 second in beforeEach
    expect(stageManager.isStageOverTime()).toBe(false);

    // Wait 1.1s
    await new Promise((r) => setTimeout(r, 1100));

    expect(stageManager.isStageOverTime()).toBe(true);
  });

  it("should reset timer on stage transition", async () => {
    // INTRO
    await new Promise((r) => setTimeout(r, 1100));
    expect(stageManager.isStageOverTime()).toBe(true);

    // Transition to MAIN_TECHNICAL
    stageManager.transitionToNext();

    // Should be fresh
    expect(stageManager.isStageOverTime()).toBe(false);
  });
});
