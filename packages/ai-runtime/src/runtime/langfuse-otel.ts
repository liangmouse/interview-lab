import type { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
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
  provider?: NodeTracerProvider;
  started: boolean;
  shutdownRegistered: boolean;
  serviceName?: string;
  exportMode?: "batched" | "immediate";
  shuttingDown: boolean;
  initializingPromise?: Promise<boolean>;
}

const STATE_KEY = "__interviewclawLangfuseTelemetry";

type TelemetryRuntimeModules = {
  NodeTracerProvider: typeof import("@opentelemetry/sdk-trace-node").NodeTracerProvider;
  LangfuseSpanProcessor: typeof import("@langfuse/otel").LangfuseSpanProcessor;
};

async function loadTelemetryRuntimeModules(): Promise<TelemetryRuntimeModules> {
  return {
    NodeTracerProvider: (await import("@opentelemetry/sdk-trace-node"))
      .NodeTracerProvider as TelemetryRuntimeModules["NodeTracerProvider"],
    LangfuseSpanProcessor: (await import("@langfuse/otel"))
      .LangfuseSpanProcessor as TelemetryRuntimeModules["LangfuseSpanProcessor"],
  };
}

let telemetryRuntimeModulesLoader = loadTelemetryRuntimeModules;

export function __setTelemetryRuntimeModulesLoaderForTests(
  loader?: typeof loadTelemetryRuntimeModules,
) {
  telemetryRuntimeModulesLoader = loader ?? loadTelemetryRuntimeModules;
}

export function __loadTelemetryRuntimeModulesForTests() {
  return loadTelemetryRuntimeModules();
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
    const { NodeTracerProvider, LangfuseSpanProcessor } =
      await telemetryRuntimeModulesLoader();

    const provider = new NodeTracerProvider({
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

    provider.register();

    state.provider = provider;
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
  if (!state.started || !state.provider || state.shuttingDown) {
    return;
  }

  state.shuttingDown = true;

  try {
    await state.provider.shutdown();
    console.info("[langfuse] telemetry shutdown completed", {
      serviceName: state.serviceName,
    });
  } catch (error) {
    console.error("[langfuse] telemetry shutdown failed", error);
  } finally {
    state.started = false;
    state.provider = undefined;
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
