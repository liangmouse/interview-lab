export type ChannelKind = "web" | "feishu" | "telegram" | "livekit";

export type UserIdentityLink = {
  id: string;
  userId: string;
  channel: ChannelKind;
  externalUserId: string;
  externalTenantId?: string;
  createdAt: string;
};

export type ConversationSession = {
  id: string;
  userId: string;
  channel: ChannelKind;
  threadKey: string;
  createdAt: string;
  updatedAt: string;
};

export type JobTarget = {
  id: string;
  userId: string;
  title: string;
  company?: string;
  sourceUrl?: string;
  notes?: string;
};

export type StudyPlan = {
  id: string;
  userId: string;
  goal: string;
  milestones: string[];
  dailyChecklist: string[];
};

export type InterviewDebrief = {
  id: string;
  userId: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  nextActions: string[];
};

export type PlannedTaskStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed";

export type WorkflowTrigger = "schedule" | "event" | "manual";

export type PlannedTask = {
  id: string;
  dedupeKey: string;
  capability: string;
  trigger: WorkflowTrigger;
  status: PlannedTaskStatus;
  attempt: number;
  payload: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type CapabilityRun<TOutput = unknown> = {
  id: string;
  capability: string;
  summary: string;
  output: TOutput;
};

export type RoleFamily =
  | "frontend"
  | "backend"
  | "fullstack"
  | "mobile"
  | "ai"
  | "data"
  | "infra"
  | "general";

export type QuestionType =
  | "knowledge"
  | "project"
  | "algorithm"
  | "system_design"
  | "behavioral";

export type Seniority = "campus" | "junior" | "mid" | "senior" | "expert";

export type InterviewScope = "global" | "company" | "role";

export type FollowUpAction =
  | "drill_down"
  | "ask_example"
  | "ask_counterfactual"
  | "ask_principle"
  | "cross_check"
  | "switch_topic"
  | "lower_difficulty"
  | "raise_difficulty";

export type MasteryLevel = "unknown" | "memorized" | "applied" | "deep";

export type RiskFlag =
  | "vague_answer"
  | "no_example"
  | "low_metric_detail"
  | "role_unclear"
  | "possible_bluffing"
  | "principle_gap"
  | "answer_incomplete";

export type QuestionAsset = {
  id: string;
  questionText: string;
  referenceAnswer?: string;
  questionType: QuestionType;
  roleFamily: RoleFamily;
  seniority: Seniority;
  topics: string[];
  difficulty: number;
  expectedSignals: string[];
  goodAnswerRubric: string[];
  badAnswerPatterns: string[];
  followUpTemplates: Partial<Record<FollowUpAction, string[]>>;
  sourceType: string;
  sourceRef?: string;
  qualityScore: number;
  language: string;
  companyTag?: string;
};

export type InterviewerProfile = {
  id: string;
  name: string;
  scope: InterviewScope;
  tone: string;
  depthPreference: number;
  algorithmWeight: number;
  projectWeight: number;
  behaviorWeight: number;
  followUpStyle: string;
  roleFamily?: RoleFamily;
  companyTag?: string;
};

export type CandidateProfile = {
  roleFamily: RoleFamily;
  seniority: Seniority;
  experienceYears: number;
  targetCompany?: string;
  targetRole?: string;
  skills: string[];
};

export type InterviewPlanQuestion = {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  topics: string[];
  expectedSignals: string[];
  followUpTemplates: Partial<Record<FollowUpAction, string[]>>;
  score: number;
};

export type InterviewPlan = {
  id: string;
  interviewId: string;
  summary: string;
  candidateProfile: CandidateProfile;
  interviewerProfileId?: string;
  plannedTopics: string[];
  questions: InterviewPlanQuestion[];
  createdAt: string;
};

export type AnswerSignalAnalysis = {
  answered: boolean;
  completeness: number;
  specificity: number;
  correctnessConfidence: number;
  evidenceSignals: string[];
  missingSignals: string[];
  riskFlags: RiskFlag[];
  masteryEstimate: MasteryLevel;
  notes: string[];
};

export type FollowUpDecision = {
  action: FollowUpAction;
  reason: string;
  shouldAdvance: boolean;
  nextQuestionId?: string;
  questionText: string;
};

export type CandidateStateSnapshot = {
  interviewId: string;
  turnId: string;
  masteryByTopic: Record<string, MasteryLevel>;
  riskFlags: RiskFlag[];
  coverageStatus: Record<string, "covered" | "pending">;
  recommendedNextAction: FollowUpAction;
};

export type InterviewDecision = {
  interviewId: string;
  turnId: string;
  selectedQuestionId: string;
  retrievalEvidence: string[];
  decisionType: FollowUpAction | "main_question";
  decisionReason: string;
  alternativeCandidates: string[];
};

export type EvaluationTrace = {
  questionId: string;
  questionType: QuestionType;
  expectedSignals: string[];
  candidateAnswerSpan: string[];
  detectedSignals: string[];
  missingSignals: string[];
  riskFlags: RiskFlag[];
  followUpReason: string;
  scoreByDimension: Record<string, number>;
  finalComment: string;
  confidence: number;
};
