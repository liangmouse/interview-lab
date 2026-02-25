import { describe, expect, it } from "vitest";
import {
  getRequiredSupabaseAdminEnv,
  getRequiredSupabasePublicEnv,
} from "@/lib/supabase/env";

describe("supabase env helpers", () => {
  it("uses anon key when provided", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: "publishable-key",
    };

    expect(getRequiredSupabasePublicEnv(env)).toEqual({
      url: "https://example.supabase.co",
      key: "anon-key",
    });
  });

  it("falls back to publishable default key when anon key is missing", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY: "publishable-key",
    };

    expect(getRequiredSupabasePublicEnv(env)).toEqual({
      url: "https://example.supabase.co",
      key: "publishable-key",
    });
  });

  it("throws a clear error when public supabase env is missing", () => {
    expect(() => getRequiredSupabasePublicEnv({})).toThrowError(
      "Your project's URL and Key are required to create a Supabase client!",
    );
  });

  it("prefers service role key for admin env", () => {
    const env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    };

    expect(getRequiredSupabaseAdminEnv(env)).toEqual({
      url: "https://example.supabase.co",
      key: "service-role-key",
    });
  });

  it("reads NEXT_PUBLIC env directly when no env object is passed", () => {
    const previousUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const previousPublishable =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY =
      "publishable-key";

    expect(getRequiredSupabasePublicEnv()).toEqual({
      url: "https://example.supabase.co",
      key: "publishable-key",
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
  });
});
