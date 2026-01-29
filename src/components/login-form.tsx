"use client";

import type React from "react";
import { useState, useEffect, useTransition } from "react";
import { Mail, Lock, Github } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Link, useRouter } from "@/i18n/navigation";
import { loginWithGoogle, loginWithGithub } from "@/lib/auth-client";
import { useUserStore } from "@/store/user";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateUserProfile } from "@/action/user-profile";
import { useTranslations } from "next-intl";

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<
    "google" | "github" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const { setUserInfo } = useUserStore();
  // useTransition 追踪导航状态
  const [isPending, startTransition] = useTransition();

  // 综合 loading 状态
  const isBusy = isLoading || isPending;

  // 检查 URL 参数中的错误信息（来自 OAuth callback）
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
      // 清除 URL 中的错误参数
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setError(error.message);
        setIsLoading(false);
        return;
      }

      if (data.user) {
        const userProfile = await getOrCreateUserProfile(data.user);
        if (userProfile) {
          setUserInfo(userProfile);
        }
        toast.success(t("loginSuccess"));
        // API 完成，重置 isLoading
        setIsLoading(false);
        // 使用 startTransition 追踪导航状态
        startTransition(() => {
          router.push("/dashboard");
        });
      }
    } catch (err) {
      setError(t("loginError"));
      setIsLoading(false);
      console.error("Login error:", err);
    }
  };

  const handleOAuthLogin = async (provider: "google" | "github") => {
    setError(null);
    setIsOAuthLoading(provider);
    try {
      if (provider === "google") {
        await loginWithGoogle();
      } else {
        await loginWithGithub();
      }
    } catch (err) {
      setError(t("oauthError") || "第三方登录失败，请重试");
      setIsOAuthLoading(null);
      console.error(`${provider} login error:`, err);
    }
  };

  return (
    <div className="w-full">
      <div className="p-8 flex flex-col justify-center">
        <div className="mb-8 space-y-2">
          <h1 className="text-3xl font-light text-[#141414] tracking-tight">
            {t("welcomeBack")}
          </h1>
          <p className="text-base text-[#666666]">{t("welcomeBackDesc")}</p>
        </div>

        <div className="space-y-6">
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-12 border-gray-200 bg-white hover:bg-gray-50 text-[#141414] hover:!text-[#141414] font-normal"
              onClick={() => handleOAuthLogin("github")}
              loading={isOAuthLoading === "github"}
              disabled={isBusy || isOAuthLoading !== null}
            >
              <Github className="mr-2 h-5 w-5" />
              {isOAuthLoading === "github"
                ? t("signingIn")
                : t("continueWithGithub")}
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 border-gray-200 bg-white hover:bg-gray-50 text-[#141414] hover:!text-[#141414] font-normal"
              onClick={() => handleOAuthLogin("google")}
              loading={isOAuthLoading === "google"}
              disabled={isBusy || isOAuthLoading !== null}
            >
              <FcGoogle className="mr-2 h-5 w-5" />
              {isOAuthLoading === "google"
                ? t("signingIn")
                : t("continueWithGoogle")}
            </Button>

            <div className="relative py-2">
              <Separator className="bg-gray-200" />
              <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 text-xs text-[#666666]">
                {t("orContinueWith")}
              </span>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="login-email"
                  className="text-xs uppercase tracking-wide text-[#666666] font-medium"
                >
                  {t("email")}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#666666]" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder={t("emailPlaceholder")}
                    className="pl-11 h-12 bg-gray-50 border-gray-200 text-[#141414] placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-emerald-600/20 focus-visible:border-emerald-600 focus-visible:bg-white transition-all"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError(null);
                    }}
                    disabled={isBusy || isOAuthLoading !== null}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="login-password"
                  className="text-xs uppercase tracking-wide text-[#666666] font-medium"
                >
                  {t("password")}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#666666]" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-11 h-12 bg-gray-50 border-gray-200 text-[#141414] placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-emerald-600/20 focus-visible:border-emerald-600 focus-visible:bg-white transition-all"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    disabled={isBusy || isOAuthLoading !== null}
                    required
                  />
                </div>
              </div>

              <div className="flex items-center justify-end">
                <Link
                  href="/forgot-password"
                  className="text-xs text-[#666666] hover:text-[#141414] transition-colors"
                >
                  {t("forgotPassword")}
                </Link>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-[#059669] hover:bg-[#059669]/90 text-white font-medium text-base transition-all shadow-sm hover:shadow-md cursor-pointer"
                loading={isBusy}
                disabled={isOAuthLoading !== null}
              >
                {isBusy
                  ? isPending
                    ? "正在跳转..."
                    : t("signIn")
                  : t("signIn")}
              </Button>
            </form>

            <p className="text-xs text-center text-[#666666]">
              {t("noAccount")}{" "}
              <Link
                href="/auth/sign-up"
                className="text-[#141414] hover:underline font-medium"
              >
                {t("signUp")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
