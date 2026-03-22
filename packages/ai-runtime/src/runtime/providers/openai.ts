import { OpenAI } from "openai";
import type { RuntimeProvider } from "./types";

export function createOpenAIProvider(input: {
  apiKey: string;
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof globalThis.fetch;
  id?: string;
}): RuntimeProvider {
  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new Error("apiKey is required");
  }

  const baseURL = input.baseURL?.trim() || "https://api.openai.com/v1";
  const rawFetch = input.fetch ?? globalThis.fetch.bind(globalThis);

  return {
    id: input.id?.trim() || "openai",
    api: "openai-responses",
    baseURL,
    createClientFetch() {
      return async (resource, init) => {
        return rawFetch(resource, withBearerAuth(init, apiKey, input.headers));
      };
    },
    createOpenAIClient(runtimeApiKey = apiKey) {
      return new OpenAI({
        apiKey: runtimeApiKey,
        baseURL,
        fetch: this.createClientFetch(),
      });
    },
  };
}

function withBearerAuth(
  init: RequestInit | undefined,
  token: string,
  extraHeaders?: Record<string, string>,
): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);
  for (const [key, value] of Object.entries(extraHeaders ?? {})) {
    headers.set(key, value);
  }

  return {
    ...init,
    headers,
  };
}
