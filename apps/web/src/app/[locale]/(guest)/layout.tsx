import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import type React from "react";

type Props = {
  children: React.ReactNode;
};

export default async function GuestLayout({ children }: Props) {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return <>{children}</>;
}
