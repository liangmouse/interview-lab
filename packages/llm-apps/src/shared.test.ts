import { beforeEach, describe, expect, it, vi } from "vitest";

const resolveOpenAICompatibleConfig = vi.fn();
const resolveAiModelRoute = vi.fn();

vi.mock("@interviewclaw/ai-runtime", () => ({
  createLangChainChatModel: vi.fn(() => ({
    withStructuredOutput: vi.fn(),
  })),
  mergeLangfuseTracingContext: (...contexts: any[]) =>
    contexts.filter(Boolean).reduce(
      (acc: any, current: any) => ({
        ...acc,
        ...current,
      }),
      {},
    ),
  resolveOpenAICompatibleConfig,
  resolveAiModelRoute,
}));

vi.mock("@interviewclaw/data-access", () => ({
  getResumeRecordByStoragePath: vi.fn(),
  getSupabaseAdminClient: vi.fn(),
  upsertResumeRecord: vi.fn(),
}));

vi.mock("unpdf", () => ({
  extractText: vi.fn(),
}));

describe("llm-apps/shared.getCapabilityModelInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.QUESTIONING_MODEL;
  });

  it("uses the explicit env model when configured", async () => {
    process.env.QUESTIONING_MODEL = "anthropic/claude-sonnet-4.6";
    resolveOpenAICompatibleConfig.mockReturnValue({
      providerId: "openrouter",
      model: "anthropic/claude-sonnet-4.6",
    });

    const { getCapabilityModelInfo } = await import("./shared");
    const result = getCapabilityModelInfo({
      envModelKey: "QUESTIONING_MODEL",
      useCase: "question-predict",
    });

    expect(resolveOpenAICompatibleConfig).toHaveBeenCalledWith({
      defaultModel: "anthropic/claude-sonnet-4.6",
    });
    expect(resolveAiModelRoute).not.toHaveBeenCalled();
    expect(result).toEqual({
      providerId: "openrouter",
      model: "anthropic/claude-sonnet-4.6",
    });
  });

  it("uses the use-case route when no explicit env model is configured", async () => {
    resolveAiModelRoute.mockReturnValue({
      providerId: "openrouter",
      model: "anthropic/claude-sonnet-4.6",
    });

    const { getCapabilityModelInfo } = await import("./shared");
    const result = getCapabilityModelInfo({
      envModelKey: "QUESTIONING_MODEL",
      useCase: "question-predict",
    });

    expect(resolveAiModelRoute).toHaveBeenCalledWith({
      useCase: "question-predict",
      userTier: undefined,
    });
    expect(result).toEqual({
      providerId: "openrouter",
      model: "anthropic/claude-sonnet-4.6",
    });
  });
});
