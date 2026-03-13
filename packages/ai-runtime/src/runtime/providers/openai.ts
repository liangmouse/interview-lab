import { OpenAI } from "openai";
import type { RuntimeProvider } from "./types";

export function createOpenAIProvider(input: {
  apiKey: string;
  baseURL?: string;
  fetch?: typeof globalThis.fetch;
}): RuntimeProvider {
  const apiKey = input.apiKey.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required");
  }

  const baseURL = input.baseURL?.trim() || "https://api.openai.com/v1";
  const rawFetch = input.fetch ?? globalThis.fetch.bind(globalThis);

  return {
    id: "openai",
    api: "openai-responses",
    baseURL,
    createClientFetch() {
      return async (resource, init) => {
        return rawFetch(resource, withBearerAuth(init, apiKey));
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
): RequestInit {
  const headers = new Headers(init?.headers);
  headers.set("authorization", `Bearer ${token}`);

  return {
    ...init,
    headers,
  };
}
