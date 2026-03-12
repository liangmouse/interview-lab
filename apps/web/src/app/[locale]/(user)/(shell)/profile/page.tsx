import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ProfileIdentityCard } from "@/components/dashboard/profile-identity-card";
import { ProfileCenter } from "@/components/dashboard/profile-center";
import { ProfileSubscriptionCard } from "@/components/dashboard/profile-subscription-card";

export default function ProfilePage() {
  return (
    <>
      <DashboardHeader
        breadcrumbs={[
          { labelKey: "title", href: "/dashboard" },
          { labelKey: "dashboard.pages.profile" },
        ]}
      />

      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)]">
          <div className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <ProfileIdentityCard />
            <ProfileSubscriptionCard />
          </div>
          <div className="min-w-0">
            <ProfileCenter />
          </div>
        </div>
      </main>
    </>
  );
}
