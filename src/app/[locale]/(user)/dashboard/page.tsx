import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { QuickStartCard } from "@/components/dashboard/quick-start-card";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { RecentActivity } from "@/components/dashboard/recent-activity";

export default async function DashboardPage() {
  return (
    <DashboardShell>
      <DashboardHeader />
      <main className="flex-1 overflow-y-auto p-6 lg:p-10 relative z-10 scroll-smooth">
        <div className="mx-auto max-w-7xl space-y-5 pb-10">
          <WelcomeBanner />
          <QuickStartCard />
          <StatsGrid />
          <RecentActivity />
        </div>
      </main>
    </DashboardShell>
  );
}
