import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { UserProfile } from "@/types/profile";

interface UserState {
  userInfo: UserProfile | null;
  /** 标记 store 是否已从 localStorage 恢复完成 */
  _hasHydrated: boolean;
  setUserInfo: (profile: UserProfile | null) => void;
  clearUserInfo: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      userInfo: null,
      _hasHydrated: false,
      setUserInfo: (profile) => set({ userInfo: profile }),
      clearUserInfo: () => set({ userInfo: null }),
      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: "user-storage", // localStorage key
      storage: createJSONStorage(() => localStorage),
      // 恢复完成后的回调
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      // 不持久化 _hasHydrated 字段
      partialize: (state) => ({
        userInfo: state.userInfo,
      }),
    },
  ),
);
