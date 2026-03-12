import { redirect } from "next/navigation";

export default function AuthPage() {
  // 默认重定向到登录页面
  redirect("/auth/sign-in");
}
