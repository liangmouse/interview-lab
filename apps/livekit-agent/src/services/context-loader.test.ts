import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "./context-loader";

describe("buildSystemPrompt", () => {
  it("should wrap candidate/interview context with readonly tags", () => {
    const base = "BASE_PROMPT";
    const profile = {
      nickname: "Alice",
      job_intention: "Frontend",
      experience_years: 3,
      skills: ["React", "TypeScript"],
      work_experiences: [
        {
          company: "Acme",
          position: "Engineer",
          start_date: "2022",
          end_date: "2024",
          description: "Did things",
        },
      ],
      project_experiences: [
        {
          project_name: "Proj",
          role: "Owner",
          tech_stack: ["Next.js"],
          description: "Built stuff",
        },
      ],
    };
    const interview = { type: "frontend:mid", duration: 30, status: "active" };

    const full = buildSystemPrompt(profile, base, interview);

    expect(full).toContain(base);
    expect(full).toContain('<candidate_context readonly="true">');
    expect(full).toContain("</candidate_context>");
    expect(full).toContain('<interview_context readonly="true">');
    expect(full).toContain("</interview_context>");
    expect(full).toContain('<runtime_directives readonly="true">');
    expect(full).toContain("</runtime_directives>");
  });
});
