import { InterviewStage } from "./types";
const DEFAULT_CONFIGS = {
    [InterviewStage.INTRO]: { durationRatio: 0.1, weight: 1 }, // 10%
    [InterviewStage.MAIN_TECHNICAL]: { durationRatio: 0.6, weight: 2 }, // 60%
    [InterviewStage.SOFT_SKILLS]: { durationRatio: 0.2, weight: 1 }, // 20%
    [InterviewStage.CLOSING]: { durationRatio: 0.1, weight: 1 }, // 10%
};
const MIN_STAGE_DURATION_SECONDS = 60; // Minimum 1 minute per stage if possible
export class StageManager {
    constructor(totalDurationSeconds, customConfigs) {
        this.totalDurationSeconds = totalDurationSeconds;
        this.state = {
            currentStage: InterviewStage.INTRO,
            stageStartTime: Date.now(),
            stageConfigs: Object.assign(Object.assign({}, DEFAULT_CONFIGS), customConfigs),
            coveredTopics: [],
            stageSummaries: {},
        };
    }
    get currentState() {
        return Object.assign({}, this.state);
    }
    getStageSummaries() {
        return this.state.stageSummaries;
    }
    addStageSummary(stage, summary) {
        this.state.stageSummaries[stage] = summary;
    }
    getCurrentStage() {
        return this.state.currentStage;
    }
    startStage(stage) {
        if (this.state.currentStage === stage)
            return;
        console.log(`[StageManager] Transitioning from ${this.state.currentStage} to ${stage}`);
        this.state.currentStage = stage;
        this.state.stageStartTime = Date.now();
        this.state.coveredTopics = [];
    }
    /**
     * Checks if the current stage has exceeded its time budget.
     */
    isStageOverTime() {
        const config = this.state.stageConfigs[this.state.currentStage];
        if (!config)
            return false;
        // Calculate target seconds based on ratio
        let targetSeconds = Math.floor(this.totalDurationSeconds * config.durationRatio);
        // Ensure minimum duration (unless total interview is extremely short)
        if (this.totalDurationSeconds > 300) {
            targetSeconds = Math.max(targetSeconds, MIN_STAGE_DURATION_SECONDS);
        }
        const elapsedSeconds = (Date.now() - this.state.stageStartTime) / 1000;
        return elapsedSeconds > targetSeconds;
    }
    getNextStage() {
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
    transitionToNext() {
        const next = this.getNextStage();
        if (next) {
            this.startStage(next);
        }
        return next;
    }
}
