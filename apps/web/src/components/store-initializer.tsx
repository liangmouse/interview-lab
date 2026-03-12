"use client";

import { useRef, useEffect } from "react";
import { useUserStore } from "@/store/user";
import type { UserProfile } from "@/types/profile";

function StoreInitializer({ userInfo }: { userInfo: UserProfile | null }) {
  const initialized = useRef(false);
  const { setUserInfo, userInfo: storedUserInfo } = useUserStore();

  useEffect(() => {
    // 只有在服务端传来的用户信息存在且与当前存储的不同时才更新
    if (
      !initialized.current &&
      userInfo &&
      (!storedUserInfo || storedUserInfo.id !== userInfo.id)
    ) {
      setUserInfo(userInfo);
      initialized.current = true;
    }
  }, [userInfo, storedUserInfo, setUserInfo]);

  return null;
}

export default StoreInitializer;
