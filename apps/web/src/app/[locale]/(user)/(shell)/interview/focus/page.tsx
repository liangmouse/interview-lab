import { redirect } from "next/navigation";

export default function FocusInterviewPage() {
  redirect("/interview?mode=focus");
}
