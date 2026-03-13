import { beforeEach, describe, expect, it, vi } from "vitest";
import { runCliCommand } from "./dispatch";

describe("cli/dispatch", () => {
  const runWorkerMode = vi.fn();
  const authLogin = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles auth login openai-codex --remote without starting worker mode", async () => {
    const handled = await runCliCommand(
      ["auth", "login", "openai-codex", "--remote"],
      {
        agentModuleUrl: "file:///agent/main.ts",
        runWorkerMode,
        authLogin,
      },
    );

    expect(handled).toBe(true);
    expect(authLogin).toHaveBeenCalledWith({ remote: true });
    expect(runWorkerMode).not.toHaveBeenCalled();
  });

  it("falls back to worker mode for non-auth commands", async () => {
    const handled = await runCliCommand(["dev"], {
      agentModuleUrl: "file:///agent/main.ts",
      runWorkerMode,
      authLogin,
    });

    expect(handled).toBe(false);
    expect(authLogin).not.toHaveBeenCalled();
  });
});
