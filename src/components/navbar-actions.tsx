"use client";

import { useRouter } from "@/i18n/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/user";

/**
 * Navbar 操作按钮组件（客户端组件）
 */
export function NavbarActions() {
  const router = useRouter();
  const { userInfo } = useUserStore();
  const [mounted, setMounted] = useState(false);

  // 确保在客户端渲染后再检查用户状态
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = () => {
    router.push("/auth/sign-in");
  };

  const handleGetStarted = () => {
    // 如果已登录，跳转到 dashboard；否则跳转到注册页
    if (userInfo) {
      router.push("/dashboard");
    } else {
      router.push("/auth/sign-in?tab=sign-up");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="sm"
        className="hidden sm:inline-flex"
        onClick={handleLogin}
      >
        Login
      </Button>
      <Button
        size="sm"
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        onClick={handleGetStarted}
      >
        {mounted && userInfo ? "Dashboard" : "Get Started"}
      </Button>
    </div>
  );
}
