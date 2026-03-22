import { describe, expect, it } from "vitest";
import {
  OPENAI_CODEX_OAUTH_COOKIE,
  createAuthProfileStore,
  createOpenAICodexAuthProvider,
} from "./index";

describe("ai-runtime index", () => {
  it("exposes auth exports without requiring optional pi-ai package", () => {
    expect(OPENAI_CODEX_OAUTH_COOKIE).toBe("openai-codex-oauth");
    expect(createOpenAICodexAuthProvider).toBeTypeOf("function");
    expect(createAuthProfileStore).toBeTypeOf("function");
  });
});
