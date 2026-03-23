import type { Callbacks } from "@langchain/core/callbacks/manager";
import { CallbackHandler } from "@langfuse/langchain";
import {
  observeOpenAI,
  type LangfuseConfig as LangfuseOpenAIConfig,
} from "@langfuse/openai";

export interface LangfuseTracingContext {
  userId?: string;
  sessionId?: string;
  traceName?: string;
  generationName?: string;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

export function isLangfuseEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const enabled = normalizeString(env.LANGFUSE_ENABLED);
  if (enabled && FALSE_VALUES.has(enabled.toLowerCase())) {
    return false;
  }

  return Boolean(
    normalizeString(env.LANGFUSE_PUBLIC_KEY) &&
      normalizeString(env.LANGFUSE_SECRET_KEY),
  );
}

export function createLangfuseLangChainCallbacks(
  context?: LangfuseTracingContext,
): Callbacks | undefined {
  if (!isLangfuseEnabled()) {
    return undefined;
  }

  const tags = normalizeTags(context?.tags);
  const version = resolveLangfuseVersion();

  return [
    new CallbackHandler({
      ...(context?.userId ? { userId: context.userId } : {}),
      ...(context?.sessionId ? { sessionId: context.sessionId } : {}),
      ...(tags ? { tags } : {}),
      ...(context?.metadata ? { traceMetadata: context.metadata } : {}),
      ...(version ? { version } : {}),
    }),
  ];
}

export function observeOpenAIClient<SDKType extends object>(
  client: SDKType,
  context?: LangfuseTracingContext,
): SDKType {
  if (!isLangfuseEnabled()) {
    return client;
  }

  const tags = normalizeTags(context?.tags);
  const config: LangfuseOpenAIConfig = {
    ...(context?.traceName ? { traceName: context.traceName } : {}),
    ...(context?.generationName
      ? { generationName: context.generationName }
      : {}),
    ...(context?.userId ? { userId: context.userId } : {}),
    ...(context?.sessionId ? { sessionId: context.sessionId } : {}),
    ...(tags ? { tags } : {}),
    ...(context?.metadata ? { generationMetadata: context.metadata } : {}),
  };

  return observeOpenAI(client, config);
}

export function mergeLangfuseTracingContext(
  ...contexts: Array<LangfuseTracingContext | undefined>
): LangfuseTracingContext | undefined {
  const result: LangfuseTracingContext = {};

  for (const context of contexts) {
    if (!context) continue;

    if (context.userId) result.userId = context.userId;
    if (context.sessionId) result.sessionId = context.sessionId;
    if (context.traceName) result.traceName = context.traceName;
    if (context.generationName) result.generationName = context.generationName;
    if (context.metadata) {
      result.metadata = {
        ...(result.metadata ?? {}),
        ...context.metadata,
      };
    }
    if (context.tags?.length) {
      result.tags = [...(result.tags ?? []), ...context.tags];
    }
  }

  if (result.tags?.length) {
    result.tags = normalizeTags(result.tags);
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

function resolveLangfuseVersion(
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return (
    normalizeString(env.LANGFUSE_RELEASE) ||
    normalizeString(env.VERCEL_GIT_COMMIT_SHA) ||
    normalizeString(env.GIT_COMMIT_SHA)
  );
}

function normalizeTags(tags?: string[]) {
  if (!Array.isArray(tags)) {
    return undefined;
  }

  const normalized = [
    ...new Set(
      tags
        .map(normalizeString)
        .filter((tag): tag is string => typeof tag === "string"),
    ),
  ];
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
