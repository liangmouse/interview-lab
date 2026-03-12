import { getCurrentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import type React from "react";

type Props = {
  children: React.ReactNode;
};

export default async function UserLayout({ children }: Props) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/auth/sign-in");
  }

  return <>{children}</>;
}
