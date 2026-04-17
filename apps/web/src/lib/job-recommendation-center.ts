import type { JobSearchPreferences } from "@interviewclaw/domain";

export interface JobRecommendationManualFormValues {
  city: string;
  salaryMinK: string;
  salaryMaxK: string;
  role: string;
  industry: string;
  companySize: string;
  savePreferences: boolean;
}

export type JobRecommendationManualFormErrors = Partial<
  Record<"role" | "salaryMinK" | "salaryMaxK", string>
>;

export function validateJobRecommendationManualForm(
  values: JobRecommendationManualFormValues,
): JobRecommendationManualFormErrors {
  const errors: JobRecommendationManualFormErrors = {};

  if (!values.role.trim()) {
    errors.role = "请填写岗位";
  }

  const min = values.salaryMinK.trim();
  const max = values.salaryMaxK.trim();

  if (min && Number.isNaN(Number(min))) {
    errors.salaryMinK = "最低薪资必须是数字";
  }

  if (max && Number.isNaN(Number(max))) {
    errors.salaryMaxK = "最高薪资必须是数字";
  }

  if (
    min &&
    max &&
    !Number.isNaN(Number(min)) &&
    !Number.isNaN(Number(max)) &&
    Number(min) > Number(max)
  ) {
    errors.salaryMaxK = "最高薪资不能低于最低薪资";
  }

  return errors;
}

export function manualFormToPreferences(
  values: JobRecommendationManualFormValues,
): JobSearchPreferences {
  return {
    cities: values.city.trim() ? [values.city.trim()] : [],
    salaryMinK: values.salaryMinK.trim()
      ? Number(values.salaryMinK.trim())
      : undefined,
    salaryMaxK: values.salaryMaxK.trim()
      ? Number(values.salaryMaxK.trim())
      : undefined,
    role: values.role.trim() || undefined,
    industries: values.industry.trim() ? [values.industry.trim()] : [],
    companySizes: values.companySize.trim() ? [values.companySize.trim()] : [],
  };
}

export function emptyJobRecommendationManualForm(): JobRecommendationManualFormValues {
  return {
    city: "",
    salaryMinK: "",
    salaryMaxK: "",
    role: "",
    industry: "",
    companySize: "",
    savePreferences: false,
  };
}
