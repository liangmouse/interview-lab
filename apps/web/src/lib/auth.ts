import { createClient } from "@/lib/supabase/server";

/**
 * 获取当前用户
 * 使用 getUser() 确保数据真实性，通过联系 Supabase Auth 服务器进行验证
 */
export async function getCurrentUser() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("Error getting current user:", error);
      return null;
    }

    return user;
  } catch (error) {
    console.error("Error getting current user:", error);
    return null;
  }
}

/**
 * 获取完整的session信息
 * 使用 getUser() 确保数据真实性
 */
export async function getCurrentSession() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error) {
      console.error("Error getting current session:", error);
      return null;
    }

    // 如果有用户，返回包含用户信息的session对象
    return user ? { user } : null;
  } catch (error) {
    console.error("Error getting current session:", error);
    return null;
  }
}

export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}
