import type {
  QuestioningReport,
  QuestioningTrack,
} from "@interviewclaw/domain";

export interface ResumeLibraryItem {
  id: string;
  name: string;
  createdAt: string;
}

export type {
  QuestioningQuestion,
  QuestioningReport,
  QuestioningTrack,
} from "@interviewclaw/domain";

export interface QuestioningFormValues {
  resumeId: string;
  targetRole: string;
  track: QuestioningTrack;
  workExperience: string;
  targetCompany: string;
  jobDescription: string;
}

export type QuestioningFormErrors = Partial<
  Record<"resumeId" | "targetRole" | "workExperience", string>
>;

export function validateQuestioningForm(
  values: QuestioningFormValues,
): QuestioningFormErrors {
  const errors: QuestioningFormErrors = {};

  if (!values.resumeId.trim()) {
    errors.resumeId = "请选择简历";
  }

  if (!values.targetRole.trim()) {
    errors.targetRole = "请填写目标岗位";
  }

  if (values.track === "social" && !values.workExperience.trim()) {
    errors.workExperience = "社招模式需要选择工作年限";
  }

  return errors;
}

export function getQuestioningReportById(
  id: string,
  reports: QuestioningReport[],
): QuestioningReport | null {
  return reports.find((report) => report.id === id) ?? null;
}
