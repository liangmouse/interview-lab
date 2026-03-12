"use server";

import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/auth/sign-in");
}

export async function checkEmailExists(
  email: string,
): Promise<{ exists: boolean; checked: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return { exists: false, checked: false };
  }

  try {
    const { data, error } = await supabaseAdmin
      .from("auth.users")
      .select("id")
      .eq("email", normalizedEmail)
      .limit(1);

    if (error) {
      console.error("Error checking email existence:", error);
      return { exists: false, checked: false };
    }

    return { exists: (data?.length ?? 0) > 0, checked: true };
  } catch (err) {
    console.error("Unexpected error checking email existence:", err);
    return { exists: false, checked: false };
  }
}
