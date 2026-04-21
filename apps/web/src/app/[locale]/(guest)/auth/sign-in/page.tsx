import { LoginForm } from "@/components/login-form";
import { RegisterForm } from "@/components/register-form";
import { AuthArtwork } from "@/components/auth-artwork";
import { AuthTabs } from "@/components/auth-tabs";
import { normalizeAuthTab } from "@/lib/auth-routing";
import { getTranslations } from "next-intl/server";

type Props = {
  searchParams?:
    | Promise<{
        tab?: string | string[];
      }>
    | {
        tab?: string | string[];
      };
};

export default async function SignInPage({ searchParams }: Props) {
  const t = await getTranslations("auth");
  const { tab } = (await Promise.resolve(searchParams)) ?? {};
  const currentTab = normalizeAuthTab(tab);

  return (
    <div className="h-screen h-dvh overflow-hidden grid grid-cols-1 lg:grid-cols-[1.3fr_1fr]">
      {/* Left Column - Marketing Panel (Hidden on mobile) */}
      <div className="hidden lg:block relative h-full">
        <AuthArtwork />
      </div>

      {/* Right Column - Auth Form */}
      <div className="h-full min-h-0 flex items-center justify-center px-6 py-6 lg:px-10 lg:py-8 bg-white overflow-y-auto">
        <div className="w-full max-w-[400px] my-auto">
          <AuthTabs
            initialTab={currentTab}
            signInLabel={t("signIn")}
            signUpLabel={t("signUp")}
            signInContent={<LoginForm />}
            signUpContent={<RegisterForm />}
          />
        </div>
      </div>
    </div>
  );
}
