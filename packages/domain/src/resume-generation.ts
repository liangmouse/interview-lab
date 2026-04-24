import type { LlmJobStatus } from "./types";

export type ResumeGenerationSessionStatus = "collecting" | "ready" | "archived";

export type ResumeGenerationDirectionPreset =
  | "general"
  | "english"
  | "state-owned"
  | "hardcore-tech"
  | "marketing"
  | "postgraduate"
  | "civil-service"
  | "custom";

export type ResumeGenerationLanguage = "zh-CN" | "en-US";

export type ResumeGenerationMissingField =
  | "contact"
  | "targetRole"
  | "summary"
  | "education"
  | "experience"
  | "skills";

export type ResumeGenerationMessageRole = "assistant" | "user";

export type ResumeGenerationMessage = {
  role: ResumeGenerationMessageRole;
  content: string;
  createdAt: string;
};

export type ResumePortraitPersonalInfo = {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  github?: string;
  linkedin?: string;
};

export type ResumePortraitEducation = {
  school?: string;
  major?: string;
  degree?: string;
  graduationDate?: string;
  extraNotes?: string[];
};

export type ResumePortraitExperience = {
  company?: string;
  position?: string;
  startDate?: string;
  endDate?: string;
  summary?: string;
  highlights?: string[];
};

export type ResumePortraitProject = {
  projectName?: string;
  role?: string;
  startDate?: string;
  endDate?: string;
  techStack?: string[];
  summary?: string;
  highlights?: string[];
};

export type ResumePortraitDraft = {
  sourceResumeName?: string;
  directionPreset: ResumeGenerationDirectionPreset;
  language: ResumeGenerationLanguage;
  customStylePrompt?: string;
  targetRole?: string;
  summary?: string;
  personalInfo?: ResumePortraitPersonalInfo;
  education?: ResumePortraitEducation;
  skills: string[];
  workExperiences: ResumePortraitExperience[];
  projectExperiences: ResumePortraitProject[];
  rawUserNotes: string[];
};

export type ResumeGenerationSession = {
  id: string;
  userId: string;
  sourceResumeStoragePath: string;
  directionPreset: ResumeGenerationDirectionPreset;
  customStylePrompt?: string;
  language: ResumeGenerationLanguage;
  sessionStatus: ResumeGenerationSessionStatus;
  portraitDraft: ResumePortraitDraft;
  missingFields: ResumeGenerationMissingField[];
  assistantQuestion?: string;
  suggestedAnswerHints: string[];
  messages: ResumeGenerationMessage[];
  createdAt: string;
  updatedAt: string;
};

export type ResumeGenerationJobPayload = {
  sourceResumeStoragePath: string;
  directionPreset: ResumeGenerationDirectionPreset;
  customStylePrompt?: string;
  language: ResumeGenerationLanguage;
  portraitSnapshot: ResumePortraitDraft;
  sessionId: string;
};

export type ResumeGenerationResult = {
  versionId: string;
  title: string;
  markdownStoragePath: string;
  previewUrl: string;
  summary: string;
};

export type ResumeGenerationJob = {
  id: string;
  userId: string;
  status: LlmJobStatus;
  payload: ResumeGenerationJobPayload;
  result?: ResumeGenerationResult;
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

export type ResumeVersion = {
  id: string;
  userId: string;
  sessionId?: string;
  sourceResumeStoragePath: string;
  directionPreset: ResumeGenerationDirectionPreset;
  customStylePrompt?: string;
  language: ResumeGenerationLanguage;
  title: string;
  summary: string;
  previewSlug: string;
  markdownStoragePath: string;
  markdownContent: string;
  createdAt: string;
  updatedAt: string;
};
