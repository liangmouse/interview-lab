import { redirect } from "next/navigation";
import { CodingInterviewSession } from "@/components/interview/coding-interview-session";
import { InterviewRoom } from "@/components/interview/interview-room";
import {
  loadExistingInterviewPlan,
  requireOwnedInterview,
} from "@/lib/interview-rag-service";
import { parseInterviewType } from "@/lib/interview-session";

interface InterviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function InterviewPage({ params }: InterviewPageProps) {
  const { id } = await params;

  try {
    const { interview, profile } = await requireOwnedInterview(id);
    const parsedType = parseInterviewType(interview.type);

    if (parsedType.variant === "coding") {
      return <CodingInterviewSession interviewId={id} />;
    }

    const interviewPlan = await loadExistingInterviewPlan(id).catch((error) => {
      console.warn("[interview-page] failed to load interview plan", error);
      return null;
    });

    return (
      <InterviewRoom
        interviewId={id}
        interviewType={interview.type}
        duration={interview.duration}
        candidateContext={{
          jobIntention: profile.job_intention,
          companyIntention: profile.company_intention,
          experienceYears: profile.experience_years,
          skills: profile.skills,
          bio: profile.bio,
          hasResume: Boolean(profile.resume_url),
          workExperiences: profile.work_experiences,
          projectExperiences: profile.project_experiences,
        }}
        interviewPlan={
          interviewPlan
            ? {
                summary: interviewPlan.summary,
                plannedTopics: interviewPlan.plannedTopics,
                questions: interviewPlan.questions.map((question) => ({
                  questionText: question.questionText,
                  questionType: question.questionType,
                  topics: question.topics,
                  expectedSignals: question.expectedSignals,
                })),
              }
            : null
        }
      />
    );
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      redirect("/interview");
    }

    throw error;
  }
}
