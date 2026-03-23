import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { MockNodeSDK, MockLangfuseSpanProcessor } = vi.hoisted(() => {
  const MockNodeSDK = vi.fn(function (this: unknown, opts: unknown) {
    return {
      opts,
      start: vi.fn(),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
  });

  const MockLangfuseSpanProcessor = vi.fn(function (
    this: unknown,
    opts: unknown,
  ) {
    return { opts };
  });

  return {
    MockNodeSDK,
    MockLangfuseSpanProcessor,
  };
});

import {
  __setTelemetryRuntimeModulesLoaderForTests,
  initializeLangfuseTelemetry,
  shutdownLangfuseTelemetry,
} from "./langfuse-otel";

describe("langfuse-otel", () => {
  const savedEnv = { ...process.env };

  beforeEach(async () => {
    vi.clearAllMocks();
    __setTelemetryRuntimeModulesLoaderForTests(() => ({
      NodeSDK: MockNodeSDK as never,
      LangfuseSpanProcessor: MockLangfuseSpanProcessor as never,
    }));
    delete process.env.LANGFUSE_PUBLIC_KEY;
    delete process.env.LANGFUSE_SECRET_KEY;
    delete process.env.LANGFUSE_BASE_URL;
    delete process.env.LANGFUSE_HOST;
    delete process.env.LANGFUSE_RELEASE;
    delete process.env.NODE_ENV;
    await shutdownLangfuseTelemetry();
  });

  afterEach(async () => {
    await shutdownLangfuseTelemetry();
    __setTelemetryRuntimeModulesLoaderForTests();

    for (const key of [
      "LANGFUSE_PUBLIC_KEY",
      "LANGFUSE_SECRET_KEY",
      "LANGFUSE_BASE_URL",
      "LANGFUSE_HOST",
      "LANGFUSE_RELEASE",
      "NODE_ENV",
    ]) {
      if (savedEnv[key] !== undefined) {
        process.env[key] = savedEnv[key];
      } else {
        delete process.env[key];
      }
    }
  });

  it("does not initialize when Langfuse credentials are missing", async () => {
    const initialized = await initializeLangfuseTelemetry({
      serviceName: "test-service",
    });

    expect(initialized).toBe(false);
    expect(MockNodeSDK).not.toHaveBeenCalled();
  });

  it("initializes telemetry once with legacy host fallback", async () => {
    process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-test";
    process.env.LANGFUSE_SECRET_KEY = "sk-lf-test";
    process.env.LANGFUSE_HOST = "https://us.cloud.langfuse.com";
    process.env.LANGFUSE_RELEASE = "release-123";
    process.env.NODE_ENV = "development";

    const initialized = await initializeLangfuseTelemetry({
      serviceName: "test-service",
      exportMode: "immediate",
    });

    const initializedAgain = await initializeLangfuseTelemetry({
      serviceName: "ignored-service",
      exportMode: "batched",
    });

    expect(initialized).toBe(true);
    expect(initializedAgain).toBe(true);
    expect(process.env.LANGFUSE_BASE_URL).toBe("https://us.cloud.langfuse.com");
    expect(MockLangfuseSpanProcessor).toHaveBeenCalledWith(
      expect.objectContaining({
        publicKey: "pk-lf-test",
        secretKey: "sk-lf-test",
        baseUrl: "https://us.cloud.langfuse.com",
        environment: "development",
        release: "release-123",
        exportMode: "immediate",
      }),
    );
    expect(MockNodeSDK).toHaveBeenCalledTimes(1);
    expect(MockNodeSDK.mock.results[0]?.value.start).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent initialization", async () => {
    process.env.LANGFUSE_PUBLIC_KEY = "pk-lf-test";
    process.env.LANGFUSE_SECRET_KEY = "sk-lf-test";

    let resolveLoader:
      | ((value: {
          NodeSDK: typeof MockNodeSDK;
          LangfuseSpanProcessor: typeof MockLangfuseSpanProcessor;
        }) => void)
      | undefined;
    const loaderPromise = new Promise<{
      NodeSDK: typeof MockNodeSDK;
      LangfuseSpanProcessor: typeof MockLangfuseSpanProcessor;
    }>((resolve) => {
      resolveLoader = resolve;
    });

    __setTelemetryRuntimeModulesLoaderForTests(() => loaderPromise);

    const initA = initializeLangfuseTelemetry({
      serviceName: "test-service",
    });
    const initB = initializeLangfuseTelemetry({
      serviceName: "test-service",
    });

    resolveLoader?.({
      NodeSDK: MockNodeSDK,
      LangfuseSpanProcessor: MockLangfuseSpanProcessor,
    });

    await expect(initA).resolves.toBe(true);
    await expect(initB).resolves.toBe(true);
    expect(MockNodeSDK).toHaveBeenCalledTimes(1);
    expect(MockLangfuseSpanProcessor).toHaveBeenCalledTimes(1);
  });
});
