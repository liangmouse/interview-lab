import type { NodeSDK } from "@opentelemetry/sdk-node";
import {
  applyLegacyLangfuseEnvAliases,
  getLangfuseRelease,
  isLangfuseEnabled,
  resolveLangfuseBaseUrl,
} from "./langfuse";

export interface LangfuseTelemetryBootstrapOptions {
  serviceName: string;
  exportMode?: "batched" | "immediate";
}

interface LangfuseTelemetryState {
  sdk?: NodeSDK;
  started: boolean;
  shutdownRegistered: boolean;
  serviceName?: string;
  exportMode?: "batched" | "immediate";
  shuttingDown: boolean;
  initializingPromise?: Promise<boolean>;
}

const STATE_KEY = "__interviewclawLangfuseTelemetry";

type TelemetryRuntimeModules = {
  NodeSDK: typeof import("@opentelemetry/sdk-node").NodeSDK;
  LangfuseSpanProcessor: typeof import("@langfuse/otel").LangfuseSpanProcessor;
};

async function loadTelemetryRuntimeModules(): Promise<TelemetryRuntimeModules> {
  return {
    NodeSDK: (await import(/* webpackIgnore: true */ "@opentelemetry/sdk-node"))
      .NodeSDK as TelemetryRuntimeModules["NodeSDK"],
    LangfuseSpanProcessor: (
      await import(/* webpackIgnore: true */ "@langfuse/otel")
    ).LangfuseSpanProcessor as TelemetryRuntimeModules["LangfuseSpanProcessor"],
  };
}

let telemetryRuntimeModulesLoader = loadTelemetryRuntimeModules;

export function __setTelemetryRuntimeModulesLoaderForTests(
  loader?: typeof loadTelemetryRuntimeModules,
) {
  telemetryRuntimeModulesLoader = loader ?? loadTelemetryRuntimeModules;
}

function getState(): LangfuseTelemetryState {
  const scope = globalThis as typeof globalThis & {
    [STATE_KEY]?: LangfuseTelemetryState;
  };

  if (!scope[STATE_KEY]) {
    scope[STATE_KEY] = {
      started: false,
      shutdownRegistered: false,
      shuttingDown: false,
    };
  }

  return scope[STATE_KEY];
}

export async function initializeLangfuseTelemetry(
  options: LangfuseTelemetryBootstrapOptions,
  env: NodeJS.ProcessEnv = process.env,
) {
  applyLegacyLangfuseEnvAliases(env);

  if (!isLangfuseEnabled(env)) {
    return false;
  }

  const state = getState();
  if (state.started) {
    return true;
  }

  if (state.initializingPromise) {
    return state.initializingPromise;
  }

  state.initializingPromise = (async () => {
    const { NodeSDK, LangfuseSpanProcessor } =
      await telemetryRuntimeModulesLoader();

    const sdk = new NodeSDK({
      serviceName: options.serviceName,
      spanProcessors: [
        new LangfuseSpanProcessor({
          publicKey: env.LANGFUSE_PUBLIC_KEY,
          secretKey: env.LANGFUSE_SECRET_KEY,
          ...(resolveLangfuseBaseUrl(env)
            ? { baseUrl: resolveLangfuseBaseUrl(env) }
            : {}),
          ...(env.NODE_ENV ? { environment: env.NODE_ENV } : {}),
          ...(getLangfuseRelease(env)
            ? { release: getLangfuseRelease(env) }
            : {}),
          exportMode: options.exportMode ?? "batched",
        }),
      ],
    });

    sdk.start();

    state.sdk = sdk;
    state.started = true;
    state.serviceName = options.serviceName;
    state.exportMode = options.exportMode ?? "batched";

    console.info("[langfuse] telemetry initialized", {
      serviceName: state.serviceName,
      exportMode: state.exportMode,
      baseUrl: resolveLangfuseBaseUrl(env) ?? "https://cloud.langfuse.com",
    });

    return true;
  })();

  try {
    return await state.initializingPromise;
  } finally {
    state.initializingPromise = undefined;
  }
}

export async function shutdownLangfuseTelemetry() {
  const state = getState();
  if (!state.started || !state.sdk || state.shuttingDown) {
    return;
  }

  state.shuttingDown = true;

  try {
    await state.sdk.shutdown();
    console.info("[langfuse] telemetry shutdown completed", {
      serviceName: state.serviceName,
    });
  } catch (error) {
    console.error("[langfuse] telemetry shutdown failed", error);
  } finally {
    state.started = false;
    state.sdk = undefined;
    state.shuttingDown = false;
  }
}

export function registerLangfuseProcessShutdown() {
  const state = getState();
  if (state.shutdownRegistered) {
    return;
  }

  const handleSignal = (signal: NodeJS.Signals) => {
    void shutdownLangfuseTelemetry().finally(() => {
      process.exit(signal === "SIGINT" ? 130 : 0);
    });
  };

  process.once("SIGINT", () => handleSignal("SIGINT"));
  process.once("SIGTERM", () => handleSignal("SIGTERM"));
  process.once("beforeExit", () => {
    void shutdownLangfuseTelemetry();
  });

  state.shutdownRegistered = true;
}
