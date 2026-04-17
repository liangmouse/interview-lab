import type { LucideIcon } from "lucide-react";
import { LayoutDashboard, FileText, History, TrendingUp } from "lucide-react";

export interface SidebarItem {
  key: string;
  titleKey?: string;
  title?: string;
  href: string;
  icon: LucideIcon;
}

export interface SidebarGroup {
  key: string;
  titleKey: string;
  items: SidebarItem[];
}

export const sidebarGroups: SidebarGroup[] = [
  {
    key: "interview",
    titleKey: "interviewGroup",
    items: [
      {
        key: "interview",
        titleKey: "interview",
        href: "/interview",
        icon: LayoutDashboard,
      },
      {
        key: "records",
        titleKey: "records",
        href: "/records",
        icon: History,
      },
    ],
  },
  {
    key: "prep",
    titleKey: "prepGroup",
    items: [
      {
        key: "resumeReview",
        titleKey: "resumeReview",
        href: "/resume-review",
        icon: FileText,
      },
      {
        key: "questioningCenter",
        titleKey: "questioningCenter",
        href: "/questioning",
        icon: TrendingUp,
      },
      {
        key: "jobRecommendations",
        title: "岗位推荐",
        href: "/job-recommendations",
        icon: TrendingUp,
      },
    ],
  },
];

export function isSidebarItemActive(pathname: string, href: string): boolean {
  if (href === "/interview") {
    return pathname === "/interview";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}
