import { redirect } from "next/navigation";

export default function FullInterviewPage() {
  redirect("/interview?mode=full");
}
