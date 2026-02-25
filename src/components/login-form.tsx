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
import { authFormStyles } from "@/components/auth-form-styles";

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
      <div className={authFormStyles.panel}>
        <div className={authFormStyles.header}>
          <h1 className={authFormStyles.title}>{t("welcomeBack")}</h1>
          <p className={authFormStyles.subtitle}>{t("welcomeBackDesc")}</p>
        </div>

        <div className={authFormStyles.section}>
          <div className={authFormStyles.socialGroup}>
            <Button
              variant="outline"
              className={authFormStyles.socialButton}
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
              className={authFormStyles.socialButton}
              onClick={() => handleOAuthLogin("google")}
              loading={isOAuthLoading === "google"}
              disabled={isBusy || isOAuthLoading !== null}
            >
              <FcGoogle className="mr-2 h-5 w-5" />
              {isOAuthLoading === "google"
                ? t("signingIn")
                : t("continueWithGoogle")}
            </Button>

            <div className={authFormStyles.dividerWrap}>
              <Separator className="bg-gray-200" />
              <span className={authFormStyles.dividerText}>
                {t("orContinueWith")}
              </span>
            </div>

            <form onSubmit={handleLogin} className={authFormStyles.form}>
              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 rounded-md">
                  {error}
                </div>
              )}

              <div className={authFormStyles.field}>
                <Label htmlFor="login-email" className={authFormStyles.label}>
                  {t("email")}
                </Label>
                <div className="relative">
                  <Mail className={authFormStyles.fieldIcon} />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder={t("emailPlaceholder")}
                    className={authFormStyles.input}
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

              <div className={authFormStyles.field}>
                <Label
                  htmlFor="login-password"
                  className={authFormStyles.label}
                >
                  {t("password")}
                </Label>
                <div className="relative">
                  <Lock className={authFormStyles.fieldIcon} />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    className={authFormStyles.input}
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

              <div className={authFormStyles.auxRow}>
                <Link
                  href="/forgot-password"
                  className={authFormStyles.forgotPassword}
                >
                  {t("forgotPassword")}
                </Link>
              </div>

              <Button
                type="submit"
                className={authFormStyles.submitButton}
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

            <p className={authFormStyles.footer}>
              {t("noAccount")}{" "}
              <Link
                href="/auth/sign-in?tab=sign-up"
                className={authFormStyles.footerLink}
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
