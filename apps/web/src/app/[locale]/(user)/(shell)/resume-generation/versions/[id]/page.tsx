import { notFound } from "next/navigation";
import { getResumeVersionForUser } from "@interviewclaw/data-access";
import { ResumeVersionPreview } from "@/components/dashboard/resume-version-preview";
import { createClient } from "@/lib/supabase/server";

interface ResumeVersionPreviewPageProps {
  params: Promise<{ id: string }>;
}

export default async function ResumeVersionPreviewPage({
  params,
}: ResumeVersionPreviewPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const version = await getResumeVersionForUser(id, user.id, supabase);
  if (!version) {
    notFound();
  }

  return <ResumeVersionPreview version={version} />;
}
