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
import { createClient } from "@/lib/supabase/client";
import { checkEmailExists } from "@/action/auth";
import { getOrCreateUserProfile } from "@/action/user-profile";
import { useUserStore } from "@/store/user";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

const supabase = createClient();

export function RegisterForm() {
  const t = useTranslations("auth");
  const { setUserInfo } = useUserStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [isOAuthLoading, setIsOAuthLoading] = useState<
    "google" | "github" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  // useTransition 追踪导航状态
  const [isPending, startTransition] = useTransition();

  // 综合 loading 状态
  const isBusy = loading || isPending;

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const normalizedEmail = email.trim().toLowerCase();

    // 确认所有字段填写
    if (!normalizedEmail || !password.trim() || !confirmPassword.trim()) {
      setError(t("fillAllFields"));
      return;
    }

    // 密码一致性校验
    if (password !== confirmPassword) {
      setError(t("passwordMismatch"));
      return;
    }

    // 密码合法性基础校验
    if (password.length < 6) {
      setError(t("passwordTooShort"));
      return;
    }

    setLoading(true);

    try {
      const { exists, checked } = await checkEmailExists(normalizedEmail);
      if (checked && exists) {
        setError(t("emailAlreadyRegistered"));
        setLoading(false);
        return;
      }

      // 注册 Supabase 账户
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (error) {
        setError(error.message);
        setLoading(false);
        return;
      }

      if (data?.user?.identities?.length === 0) {
        setError(t("emailAlreadyRegistered"));
        setLoading(false);
        return;
      }

      if (data?.user) {
        // 自动创建用户 Profile 信息
        const userProfile = await getOrCreateUserProfile(data.user);
        if (userProfile) {
          setUserInfo(userProfile);
        }
        toast.success(t("registerSuccess"));
        // API 完成，重置 loading
        setLoading(false);
        // 使用 startTransition 追踪导航状态
        startTransition(() => {
          router.push("/auth/sign-in");
        });
      } else {
        setError(t("registerError"));
        setLoading(false);
      }
    } catch (err) {
      setError(t("registerError"));
      setLoading(false);
      console.error("Register error:", err);
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
      <div className="flex flex-col justify-center">
        <div className="mb-6 space-y-2">
          <h1 className="text-3xl font-light text-[#141414] tracking-tight">
            {t("createAccount")}
          </h1>
          <p className="text-base text-[#666666]">{t("createAccountDesc")}</p>
        </div>

        <div className="space-y-5">
          <div className="space-y-4">
            <Button
              variant="outline"
              className="w-full h-12 border-gray-200 bg-white hover:bg-gray-100 hover:text-[#141414] hover:border-gray-300 text-[#141414] font-normal transition-colors"
              onClick={() => handleOAuthLogin("github")}
              loading={isOAuthLoading === "github"}
            >
              <Github className="mr-2 h-5 w-5" />
              {isOAuthLoading === "github"
                ? t("signingIn")
                : t("continueWithGithub")}
            </Button>
            <Button
              variant="outline"
              className="w-full h-12 border-gray-200 bg-white hover:bg-gray-100 hover:text-[#141414] hover:border-gray-300 text-[#141414] font-normal transition-colors"
              onClick={() => handleOAuthLogin("google")}
              loading={isOAuthLoading === "google"}
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

            <form onSubmit={handleRegister} className="space-y-4">
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                  {error}
                </div>
              )}

              <div className="space-y-2">
                <Label
                  htmlFor="register-email"
                  className="text-xs uppercase tracking-wide text-[#666666] font-medium"
                >
                  {t("email")}
                </Label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#666666]" />
                  <Input
                    id="register-email"
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
                  htmlFor="register-password"
                  className="text-xs uppercase tracking-wide text-[#666666] font-medium"
                >
                  {t("password")}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#666666]" />
                  <Input
                    id="register-password"
                    type="password"
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

              <div className="space-y-2">
                <Label
                  htmlFor="register-confirm-password"
                  className="text-xs uppercase tracking-wide text-[#666666] font-medium"
                >
                  {t("confirmPassword")}
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-[#666666]" />
                  <Input
                    id="register-confirm-password"
                    type="password"
                    className="pl-11 h-12 bg-gray-50 border-gray-200 text-[#141414] placeholder:text-gray-400 focus-visible:ring-2 focus-visible:ring-emerald-600/20 focus-visible:border-emerald-600 focus-visible:bg-white transition-all"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      setError(null);
                    }}
                    disabled={isBusy || isOAuthLoading !== null}
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full h-12 bg-[#059669] hover:bg-[#059669]/90 text-white font-medium text-base transition-all shadow-sm hover:shadow-md"
                loading={isBusy}
                disabled={isOAuthLoading !== null}
              >
                {isBusy
                  ? isPending
                    ? "正在跳转..."
                    : t("createAccount")
                  : t("createAccount")}
              </Button>
            </form>

            <p className="text-xs text-center text-[#666666]">
              {t("hasAccount")}{" "}
              <Link
                href="/auth/sign-in"
                className="text-[#141414] hover:underline font-medium"
              >
                {t("signIn")}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
