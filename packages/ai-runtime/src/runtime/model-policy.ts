import {
  DEFAULT_GEMINI_MODEL,
  DEFAULT_OPENROUTER_EMBEDDING_MODEL,
  type OpenAICompatibleProviderId,
  hasConfiguredOpenAICompatibleProvider,
} from "./openai-compatible-config";

export type AiUseCase =
  | "interview-core"
  | "interview-summary"
  | "resume-parse"
  | "jd-parse"
  | "question-predict"
  | "report-generate"
  | "rag-chat"
  | "rag-embedding";

export type AiUserTier = "free" | "premium" | "internal";

type RouteCandidate = {
  providerId: OpenAICompatibleProviderId;
  model: string;
};

export interface AiModelRoute {
  useCase: AiUseCase;
  userTier: AiUserTier;
  providerId: OpenAICompatibleProviderId;
  model: string;
  fallbackModels: string[];
  temperature?: number;
  maxTokens?: number;
}

type UseCasePolicy = {
  defaults?: Pick<AiModelRoute, "temperature" | "maxTokens">;
  routes: Record<AiUserTier, RouteCandidate[]>;
};

const DEFAULT_AI_USER_TIER: AiUserTier = "premium";

const GEMINI_CHAT_FALLBACK: RouteCandidate = {
  providerId: "gemini",
  model: DEFAULT_GEMINI_MODEL,
};

const FREE_CHAT_FALLBACKS: RouteCandidate[] = [
  {
    providerId: "openrouter",
    model: "xiaomi/mimo-v2-flash",
  },
  {
    providerId: "openai",
    model: "gpt-5.4-mini",
  },
  GEMINI_CHAT_FALLBACK,
];

const PREMIUM_CHAT_FALLBACKS: RouteCandidate[] = [
  {
    providerId: "openrouter",
    model: "openai/gpt-5.4",
  },
  {
    providerId: "openai",
    model: "gpt-5.4",
  },
  GEMINI_CHAT_FALLBACK,
];

const STRUCTURED_EXTRACTION_FALLBACKS: RouteCandidate[] = [
  {
    providerId: "openrouter",
    model: "openai/gpt-5.4-mini",
  },
  {
    providerId: "openai",
    model: "gpt-5.4-mini",
  },
  GEMINI_CHAT_FALLBACK,
];

const QUESTION_PREDICT_PREMIUM_FALLBACKS: RouteCandidate[] = [
  {
    providerId: "openrouter",
    model: "anthropic/claude-sonnet-4.6",
  },
  {
    providerId: "openrouter",
    model: "minimax/minimax-m2.7",
  },
  {
    providerId: "openrouter",
    model: "deepseek/deepseek-v3.2",
  },
  GEMINI_CHAT_FALLBACK,
];

const QUESTION_PREDICT_FREE_FALLBACKS: RouteCandidate[] = [
  {
    providerId: "openrouter",
    model: "deepseek/deepseek-v3.2",
  },
  ...FREE_CHAT_FALLBACKS,
];

const EMBEDDING_FALLBACKS: RouteCandidate[] = [
  {
    providerId: "openrouter",
    model: "openai/text-embedding-3-large",
  },
  {
    providerId: "openai",
    model: "text-embedding-3-large",
  },
  {
    providerId: "gemini",
    model: "gemini-embedding-001",
  },
];

const USE_CASE_POLICIES: Record<AiUseCase, UseCasePolicy> = {
  "interview-core": {
    defaults: {
      temperature: 0.7,
      maxTokens: 4000,
    },
    routes: {
      free: FREE_CHAT_FALLBACKS,
      premium: PREMIUM_CHAT_FALLBACKS,
      internal: PREMIUM_CHAT_FALLBACKS,
    },
  },
  "interview-summary": {
    defaults: {
      temperature: 0.3,
      maxTokens: 1200,
    },
    routes: {
      free: STRUCTURED_EXTRACTION_FALLBACKS,
      premium: STRUCTURED_EXTRACTION_FALLBACKS,
      internal: PREMIUM_CHAT_FALLBACKS,
    },
  },
  "resume-parse": {
    defaults: {
      temperature: 0,
      maxTokens: 4000,
    },
    routes: {
      free: STRUCTURED_EXTRACTION_FALLBACKS,
      premium: STRUCTURED_EXTRACTION_FALLBACKS,
      internal: PREMIUM_CHAT_FALLBACKS,
    },
  },
  "jd-parse": {
    defaults: {
      temperature: 0,
      maxTokens: 2500,
    },
    routes: {
      free: STRUCTURED_EXTRACTION_FALLBACKS,
      premium: STRUCTURED_EXTRACTION_FALLBACKS,
      internal: PREMIUM_CHAT_FALLBACKS,
    },
  },
  "question-predict": {
    defaults: {
      temperature: 0.7,
      maxTokens: 2500,
    },
    routes: {
      free: QUESTION_PREDICT_FREE_FALLBACKS,
      premium: QUESTION_PREDICT_PREMIUM_FALLBACKS,
      internal: QUESTION_PREDICT_PREMIUM_FALLBACKS,
    },
  },
  "report-generate": {
    defaults: {
      temperature: 0.4,
      maxTokens: 4000,
    },
    routes: {
      free: STRUCTURED_EXTRACTION_FALLBACKS,
      premium: PREMIUM_CHAT_FALLBACKS,
      internal: PREMIUM_CHAT_FALLBACKS,
    },
  },
  "rag-chat": {
    defaults: {
      temperature: 0.6,
      maxTokens: 2000,
    },
    routes: {
      free: FREE_CHAT_FALLBACKS,
      premium: STRUCTURED_EXTRACTION_FALLBACKS,
      internal: PREMIUM_CHAT_FALLBACKS,
    },
  },
  "rag-embedding": {
    routes: {
      free: EMBEDDING_FALLBACKS,
      premium: EMBEDDING_FALLBACKS,
      internal: EMBEDDING_FALLBACKS,
    },
  },
};

function selectCandidate(
  candidates: RouteCandidate[],
  env: NodeJS.ProcessEnv,
): RouteCandidate {
  return (
    candidates.find((candidate) =>
      hasConfiguredOpenAICompatibleProvider(candidate.providerId, env),
    ) ?? candidates[0]
  );
}

export function getDefaultAiUserTier(): AiUserTier {
  return DEFAULT_AI_USER_TIER;
}

export function resolveAiModelRoute(input: {
  useCase: AiUseCase;
  userTier?: AiUserTier;
  env?: NodeJS.ProcessEnv;
}): AiModelRoute {
  const env = input.env ?? process.env;
  const userTier = input.userTier ?? DEFAULT_AI_USER_TIER;
  const policy = USE_CASE_POLICIES[input.useCase];
  const candidates =
    policy.routes[userTier] ?? policy.routes[DEFAULT_AI_USER_TIER];
  const selected = selectCandidate(candidates, env);
  const fallbackModels = candidates
    .filter(
      (candidate) =>
        !(
          candidate.providerId === selected.providerId &&
          candidate.model === selected.model
        ),
    )
    .map((candidate) => candidate.model);

  return {
    useCase: input.useCase,
    userTier,
    providerId: selected.providerId,
    model: selected.model,
    fallbackModels,
    temperature: policy.defaults?.temperature,
    maxTokens: policy.defaults?.maxTokens,
  };
}

export function resolveLegacyEmbeddingFallbackModel() {
  return DEFAULT_OPENROUTER_EMBEDDING_MODEL;
}
