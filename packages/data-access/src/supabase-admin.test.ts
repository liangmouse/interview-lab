import { describe, expect, it } from "vitest";
import { getRequiredSupabaseAdminEnv } from "./supabase-admin";

describe("supabase admin env helpers", () => {
  it("prefers service role from process.env when no env object is passed", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const previousPublishable =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    const previousServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";

    expect(getRequiredSupabaseAdminEnv()).toEqual({
      url: "https://example.supabase.co",
      key: "service-role-key",
    });

    if (previousUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = previousUrl;
    }

    if (previousAnon === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = previousAnon;
    }

    if (previousPublishable === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY =
        previousPublishable;
    }

    if (previousServiceRole === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = previousServiceRole;
    }
  });
});
