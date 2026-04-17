export type JobSource = "boss";

export type JobRecommendationMode = "auto" | "manual";

export type JobRecommendationFeedbackAction =
  | "saved"
  | "hidden"
  | "not_interested";

export type JobSearchPreferences = {
  cities: string[];
  salaryMinK?: number;
  salaryMaxK?: number;
  role?: string;
  industries: string[];
  companySizes: string[];
};

export type InferredJobQuery = {
  cities: string[];
  salaryRange?: {
    minK?: number;
    maxK?: number;
  };
  role?: string;
  industries: string[];
  companySizes: string[];
  reasoning: string[];
};

export type RecommendedJob = {
  sourceJobId: string;
  title: string;
  companyName: string;
  city?: string;
  salaryText?: string;
  industry?: string;
  companySize?: string;
  experience?: string;
  degree?: string;
  tags: string[];
  url?: string;
  matchScore: number;
  matchReasons: string[];
  cautions: string[];
};

export type JobRecommendationResult = {
  id: string;
  mode: JobRecommendationMode;
  source: JobSource;
  createdAt: string;
  inferredQuery: InferredJobQuery;
  summary: string;
  jobs: RecommendedJob[];
};

export type JobRecommendationJobPayload = {
  mode: JobRecommendationMode;
  source: JobSource;
  manualFilters?: JobSearchPreferences;
  savedPreferenceSnapshot?: JobSearchPreferences;
};

export type JobRecommendationJob = {
  id: string;
  userId: string;
  status: "queued" | "running" | "succeeded" | "failed";
  payload: JobRecommendationJobPayload;
  result?: JobRecommendationResult;
  errorMessage?: string;
  providerId?: string;
  model?: string;
  attemptCount: number;
  availableAt: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type JobSourceSessionStatus = "connected" | "invalid";

export type JobSourceSessionCredential = {
  cookie: string;
};

export type JobSourceSession = {
  id: string;
  userId: string;
  source: JobSource;
  status: JobSourceSessionStatus;
  validationError?: string;
  lastValidatedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type JobSourceSessionRecord = JobSourceSession & {
  credential: JobSourceSessionCredential;
};

export type JobRecommendationFeedback = {
  id: string;
  userId: string;
  source: JobSource;
  sourceJobId: string;
  action: JobRecommendationFeedbackAction;
  jobSnapshot: RecommendedJob;
  createdAt: string;
  updatedAt: string;
};
