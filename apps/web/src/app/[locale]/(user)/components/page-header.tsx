"use client";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/user";
import { HeaderAvatar } from "@/components/header-avatar";
import { LogOut } from "lucide-react";
import { useTranslations } from "next-intl";
import { logOut } from "@/action/auth";
import { toast } from "sonner";
import { useState } from "react";

export function PageHeader() {
  const t = useTranslations("nav");
  const { userInfo, clearUserInfo } = useUserStore();
  const userName = userInfo?.nickname || "";
  const userAvatar = userInfo?.avatar_url || "";
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    setLoading(true);
    try {
      // 清除客户端用户状态
      clearUserInfo();
      // 调用 server action 登出并重定向
      await logOut();
      toast.success(t("logoutSuccess") || "已退出登录");
    } catch (error) {
      console.error("Logout error:", error);
      toast.error(t("logoutError") || "退出登录失败，请重试");
      setLoading(false);
    }
  };

  return (
    <header className="backdrop-blur-md border-b border-white/20 px-6 py-4">
      <div className="flex w-full items-center justify-between max-w-7xl mx-auto">
        <nav className="flex items-center space-x-3">
          <Link href="/" className="flex items-center gap-2 w-fit">
            <Image
              src="/favicon.svg"
              alt="MockMate Logo"
              width={38}
              height={32}
            />
            <h2 className="text-black">{t("projectName")}</h2>
          </Link>
        </nav>
        <div className="flex items-center space-x-3">
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={handleLogout}
            disabled={loading}
            loading={loading}
          >
            <LogOut className="w-4 h-4" />
          </Button>
          <HeaderAvatar avatarUrl={userAvatar} userName={userName} />
        </div>
      </div>
    </header>
  );
}
