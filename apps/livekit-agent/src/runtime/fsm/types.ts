export enum InterviewStage {
  INTRO = "intro",
  MAIN_TECHNICAL = "main_technical",
  SOFT_SKILLS = "soft_skills",
  CLOSING = "closing",
}

export interface StageConfig {
  /**
   * Ratio of total interview time allocated to this stage.
   * e.g., 0.1 for 10% of total time.
   */
  durationRatio: number;
  /**
   * Weight for importance. 1 = normal, 2 = deep dive.
   */
  weight: number;
}

export interface InterviewState {
  currentStage: InterviewStage;
  stageStartTime: number;
  stageConfigs: Record<InterviewStage, StageConfig>;
  /**
   * Topics covered in the current stage.
   */
  coveredTopics: string[];
  /**
   * Summaries of completed stages.
   */
  stageSummaries: Partial<Record<InterviewStage, string>>;
}
