"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { authFormStyles } from "@/components/auth-form-styles";
import { createClient } from "@/lib/supabase/client";

type RecoveryStatus = "checking" | "ready" | "error" | "done";

function getUrlAuthError() {
  const searchParams = new URLSearchParams(window.location.search);
  const hashParams = new URLSearchParams(
    window.location.hash.replace(/^#/, ""),
  );
  const errorCode =
    searchParams.get("error_code") || hashParams.get("error_code");
  const description =
    searchParams.get("error_description") ||
    hashParams.get("error_description");

  if (errorCode === "otp_expired") {
    return "重置链接无效或已过期，请重新发送重置邮件。";
  }

  if (description) {
    return description;
  }

  if (searchParams.get("error") || hashParams.get("error")) {
    return "重置链接验证失败，请重新发送重置邮件。";
  }

  return null;
}

function hasRecoveryHash() {
  const hashParams = new URLSearchParams(
    window.location.hash.replace(/^#/, ""),
  );
  return (
    hashParams.get("type") === "recovery" &&
    Boolean(hashParams.get("access_token") || hashParams.get("refresh_token"))
  );
}

export function ResetPasswordForm() {
  const supabase = useMemo(() => createClient(), []);
  const [status, setStatus] = useState<RecoveryStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function prepareRecoverySession() {
      const urlError = getUrlAuthError();
      if (urlError) {
        setError(urlError);
        setStatus("error");
        return;
      }

      const code = new URLSearchParams(window.location.search).get("code");
      const isRecoveryLink = Boolean(code) || hasRecoveryHash();

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            throw error;
          }

          window.history.replaceState({}, "", window.location.pathname);
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) {
          throw error;
        }

        if (!data.session || !isRecoveryLink) {
          if (isMounted) {
            setError("重置链接无效或已过期，请重新发送重置邮件。");
            setStatus("error");
          }
          return;
        }

        if (isMounted) {
          setStatus("ready");
        }
      } catch (err) {
        console.error("Prepare recovery session error:", err);
        if (isMounted) {
          setError("重置链接无效或已过期，请重新发送重置邮件。");
          setStatus("error");
        }
      }
    }

    void prepareRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!password.trim() || !confirmPassword.trim()) {
      setError("请填写新密码");
      return;
    }

    if (password.length < 6) {
      setError("密码长度不能少于6位");
      return;
    }

    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message || "密码更新失败，请稍后重试");
        return;
      }

      await supabase.auth.signOut();
      setStatus("done");
      toast.success("密码已更新，请使用新密码登录");
    } catch (err) {
      console.error("Reset password update error:", err);
      setError("密码更新失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  if (status === "checking") {
    return (
      <div className="w-full">
        <div className={authFormStyles.panel}>
          <div className={authFormStyles.header}>
            <h1 className={authFormStyles.title}>正在验证链接</h1>
            <p className={authFormStyles.subtitle}>
              请稍候，我们正在验证重置密码链接。
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="w-full">
        <div className={authFormStyles.panel}>
          <div className={authFormStyles.header}>
            <h1 className={authFormStyles.title}>链接不可用</h1>
            <p className={authFormStyles.subtitle}>{error}</p>
          </div>

          <p className={authFormStyles.footer}>
            <Link href="/forgot-password" className={authFormStyles.footerLink}>
              重新发送重置邮件
            </Link>
          </p>
        </div>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="w-full">
        <div className={authFormStyles.panel}>
          <div className={authFormStyles.header}>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <h1 className={authFormStyles.title}>密码已更新</h1>
            <p className={authFormStyles.subtitle}>请使用新密码重新登录。</p>
          </div>

          <p className={authFormStyles.footer}>
            <Link href="/auth/sign-in" className={authFormStyles.footerLink}>
              返回登录
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className={authFormStyles.panel}>
        <div className={authFormStyles.header}>
          <h1 className={authFormStyles.title}>设置新密码</h1>
          <p className={authFormStyles.subtitle}>
            输入新的登录密码，更新后需要重新登录。
          </p>
        </div>

        <div className={authFormStyles.section}>
          <form onSubmit={handleSubmit} className={authFormStyles.form}>
            {error && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <div className={authFormStyles.field}>
              <Label htmlFor="reset-password" className={authFormStyles.label}>
                新密码
              </Label>
              <div className="relative">
                <Lock className={authFormStyles.fieldIcon} />
                <Input
                  id="reset-password"
                  type="password"
                  placeholder="••••••••"
                  className={authFormStyles.input}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(null);
                  }}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className={authFormStyles.field}>
              <Label
                htmlFor="reset-confirm-password"
                className={authFormStyles.label}
              >
                确认新密码
              </Label>
              <div className="relative">
                <Lock className={authFormStyles.fieldIcon} />
                <Input
                  id="reset-confirm-password"
                  type="password"
                  placeholder="••••••••"
                  className={authFormStyles.input}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    setError(null);
                  }}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <Button
              type="submit"
              className={authFormStyles.submitButton}
              loading={isLoading}
            >
              更新密码
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
