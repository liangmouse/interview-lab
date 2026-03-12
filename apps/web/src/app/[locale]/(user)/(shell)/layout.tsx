import type React from "react";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";

type Props = {
  children: React.ReactNode;
};

export default function ShellLayout({ children }: Props) {
  return <DashboardShell>{children}</DashboardShell>;
}
