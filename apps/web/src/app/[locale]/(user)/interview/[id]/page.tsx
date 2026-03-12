import { InterviewRoom } from "@/components/interview/interview-room";

interface InterviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function InterviewPage({ params }: InterviewPageProps) {
  const { id } = await params;
  return <InterviewRoom interviewId={id} />;
}
