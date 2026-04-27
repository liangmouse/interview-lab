"use client";

import type React from "react";
import { useState } from "react";
import { CheckCircle2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@/i18n/navigation";
import { authFormStyles } from "@/components/auth-form-styles";
import { createClient } from "@/lib/supabase/client";
import { getPasswordResetRedirectTo } from "@/lib/auth-redirect";

function getResetEmailErrorMessage(message?: string) {
  const normalizedMessage = (message ?? "").toLowerCase();

  if (
    normalizedMessage.includes("rate limit") ||
    normalizedMessage.includes("security purposes")
  ) {
    return "重置邮件发送过于频繁，请稍后再试。";
  }

  return message || "发送重置邮件失败，请稍后重试";
}

export function ForgotPasswordForm() {
  const supabase = createClient();
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("请输入邮箱");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedEmail,
        {
          redirectTo: getPasswordResetRedirectTo(
            window.location.pathname,
            window.location.origin,
          ),
        },
      );

      if (error) {
        setError(getResetEmailErrorMessage(error.message));
        return;
      }

      setSentEmail(normalizedEmail);
      toast.success("重置邮件已发送，请查看邮箱");
    } catch (err) {
      console.error("Reset password error:", err);
      setError("发送重置邮件失败，请稍后重试");
    } finally {
      setIsLoading(false);
    }
  };

  if (sentEmail) {
    return (
      <div className="w-full">
        <div className={authFormStyles.panel}>
          <div className={authFormStyles.header}>
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
            </div>
            <h1 className={authFormStyles.title}>重置邮件已发送</h1>
            <p className={authFormStyles.subtitle}>
              请查看 {sentEmail} 的收件箱，并按邮件提示继续。
            </p>
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
          <h1 className={authFormStyles.title}>找回密码</h1>
          <p className={authFormStyles.subtitle}>
            输入注册邮箱，我们会发送一封重置邮件。
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
              <Label htmlFor="forgot-email" className={authFormStyles.label}>
                邮箱
              </Label>
              <div className="relative">
                <Mail className={authFormStyles.fieldIcon} />
                <Input
                  id="forgot-email"
                  type="email"
                  placeholder="you@example.com"
                  className={authFormStyles.input}
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
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
              发送重置邮件
            </Button>
          </form>

          <p className={authFormStyles.footer}>
            想起密码了？{" "}
            <Link href="/auth/sign-in" className={authFormStyles.footerLink}>
              返回登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
