import { redirect } from "next/navigation";
import { CodingInterviewSession } from "@/components/interview/coding-interview-session";
import { InterviewRoom } from "@/components/interview/interview-room";
import { requireOwnedInterview } from "@/lib/interview-rag-service";
import { parseInterviewType } from "@/lib/interview-session";
import { resolveVoiceKernelFromSearchParams } from "@/lib/voice-kernel";

interface InterviewPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function InterviewPage({
  params,
  searchParams,
}: InterviewPageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const initialVoiceKernel =
    resolveVoiceKernelFromSearchParams(resolvedSearchParams);

  try {
    const { interview } = await requireOwnedInterview(id);
    const parsedType = parseInterviewType(interview.type);

    if (parsedType.variant === "coding") {
      return <CodingInterviewSession interviewId={id} />;
    }

    return (
      <InterviewRoom interviewId={id} initialVoiceKernel={initialVoiceKernel} />
    );
  } catch (error) {
    if ((error as { status?: number }).status === 404) {
      redirect("/interview");
    }

    throw error;
  }
}
