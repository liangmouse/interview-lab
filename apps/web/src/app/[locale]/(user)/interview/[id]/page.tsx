import { redirect } from "next/navigation";
import { CodingInterviewSession } from "@/components/interview/coding-interview-session";
import { InterviewRoom } from "@/components/interview/interview-room";
import { requireOwnedInterview } from "@/lib/interview-rag-service";
import { parseInterviewType } from "@/lib/interview-session";

interface InterviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function InterviewPage({ params }: InterviewPageProps) {
  const { id } = await params;

  try {
    const { interview } = await requireOwnedInterview(id);
    const parsedType = parseInterviewType(interview.type);

    if (parsedType.variant === "coding") {
      return <CodingInterviewSession interviewId={id} />;
    }

    return <InterviewRoom interviewId={id} />;
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      redirect("/interview");
    }

    throw error;
  }
}
