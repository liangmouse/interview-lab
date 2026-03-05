import { describe, expect, it } from "vitest";
import {
  getQuestioningReportById,
  validateQuestioningForm,
  type QuestioningFormValues,
} from "@/lib/questioning-center";

describe("validateQuestioningForm", () => {
  const baseValues: QuestioningFormValues = {
    resumeId: "resume-1",
    targetRole: "前端工程师",
    track: "social",
    workExperience: "3-5",
    targetCompany: "",
    jobDescription: "",
  };

  it("requires resume and target role", () => {
    const result = validateQuestioningForm({
      ...baseValues,
      resumeId: "",
      targetRole: "",
    });

    expect(result.resumeId).toBeTruthy();
    expect(result.targetRole).toBeTruthy();
  });

  it("requires work experience when social track is selected", () => {
    const result = validateQuestioningForm({
      ...baseValues,
      track: "social",
      workExperience: "",
    });

    expect(result.workExperience).toBeTruthy();
  });

  it("does not require work experience when campus track is selected", () => {
    const result = validateQuestioningForm({
      ...baseValues,
      track: "campus",
      workExperience: "",
    });

    expect(result.workExperience).toBeUndefined();
  });
});

describe("getQuestioningReportById", () => {
  it("returns matched report when id exists", () => {
    const result = getQuestioningReportById("r-1", [
      {
        id: "r-1",
        title: "test",
        targetRole: "前端",
        track: "social",
        createdAt: "2026-02-26 21:00",
        highlights: [],
        summary: "summary",
      },
    ]);

    expect(result?.id).toBe("r-1");
  });

  it("returns null when report does not exist", () => {
    expect(getQuestioningReportById("not-exists", [])).toBeNull();
  });
});
