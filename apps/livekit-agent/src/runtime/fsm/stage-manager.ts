import { InterviewStage, InterviewState, StageConfig } from "./types";

const DEFAULT_CONFIGS: Record<InterviewStage, StageConfig> = {
  [InterviewStage.INTRO]: { durationRatio: 0.1, weight: 1 }, // 10%
  [InterviewStage.MAIN_TECHNICAL]: { durationRatio: 0.6, weight: 2 }, // 60%
  [InterviewStage.SOFT_SKILLS]: { durationRatio: 0.2, weight: 1 }, // 20%
  [InterviewStage.CLOSING]: { durationRatio: 0.1, weight: 1 }, // 10%
};

const MIN_STAGE_DURATION_SECONDS = 60; // Minimum 1 minute per stage if possible

export class StageManager {
  private state: InterviewState;
  private totalDurationSeconds: number;

  constructor(
    totalDurationSeconds: number,
    customConfigs?: Partial<Record<InterviewStage, StageConfig>>,
  ) {
    this.totalDurationSeconds = totalDurationSeconds;
    this.state = {
      currentStage: InterviewStage.INTRO,
      stageStartTime: Date.now(),
      stageConfigs: { ...DEFAULT_CONFIGS, ...customConfigs },
      coveredTopics: [],
      stageSummaries: {},
    };
  }

  get currentState(): InterviewState {
    return { ...this.state };
  }

  getStageSummaries(): Partial<Record<InterviewStage, string>> {
    return this.state.stageSummaries;
  }

  addStageSummary(stage: InterviewStage, summary: string) {
    this.state.stageSummaries[stage] = summary;
  }

  getCurrentStage(): InterviewStage {
    return this.state.currentStage;
  }

  startStage(stage: InterviewStage) {
    if (this.state.currentStage === stage) return;

    console.log(
      `[StageManager] Transitioning from ${this.state.currentStage} to ${stage}`,
    );
    this.state.currentStage = stage;
    this.state.stageStartTime = Date.now();
    this.state.coveredTopics = [];
  }

  /**
   * Checks if the current stage has exceeded its time budget.
   */
  isStageOverTime(): boolean {
    const config = this.state.stageConfigs[this.state.currentStage];
    if (!config) return false;

    // Calculate target seconds based on ratio
    let targetSeconds = Math.floor(
      this.totalDurationSeconds * config.durationRatio,
    );
    // Ensure minimum duration (unless total interview is extremely short)
    if (this.totalDurationSeconds > 300) {
      targetSeconds = Math.max(targetSeconds, MIN_STAGE_DURATION_SECONDS);
    }

    const elapsedSeconds = (Date.now() - this.state.stageStartTime) / 1000;
    return elapsedSeconds > targetSeconds;
  }

  getNextStage(): InterviewStage | null {
    switch (this.state.currentStage) {
      case InterviewStage.INTRO:
        return InterviewStage.MAIN_TECHNICAL;
      case InterviewStage.MAIN_TECHNICAL:
        return InterviewStage.SOFT_SKILLS;
      case InterviewStage.SOFT_SKILLS:
        return InterviewStage.CLOSING;
      case InterviewStage.CLOSING:
        return null; // End of interview
      default:
        return null;
    }
  }

  transitionToNext(): InterviewStage | null {
    const next = this.getNextStage();
    if (next) {
      this.startStage(next);
    }
    return next;
  }
}
