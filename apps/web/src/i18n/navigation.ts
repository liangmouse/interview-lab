import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

// 创建国际化导航工具
// 使用这些导出替代 next/link 和 next/navigation
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
