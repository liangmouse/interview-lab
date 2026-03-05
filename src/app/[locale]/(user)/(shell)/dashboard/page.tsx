import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";
import { QuickStartCard } from "@/components/dashboard/quick-start-card";
import { StatsGrid } from "@/components/dashboard/stats-grid";
import { RecentActivity } from "@/components/dashboard/recent-activity";

export default async function DashboardPage() {
  return (
    <>
      <DashboardHeader />
      <main className="relative z-10 flex-1 overflow-y-auto p-6 scroll-smooth lg:p-10">
        <div className="mx-auto max-w-7xl space-y-5 pb-10">
          <WelcomeBanner />
          <QuickStartCard />
          <StatsGrid />
          <RecentActivity />
        </div>
      </main>
    </>
  );
}
