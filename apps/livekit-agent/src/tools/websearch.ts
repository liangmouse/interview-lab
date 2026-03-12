import { llm } from "@livekit/agents";
import { z } from "zod";

const EXA_SEARCH_ENDPOINT = "https://api.exa.ai/search";
const DEFAULT_NUM_RESULTS = 8;
const DEFAULT_MAX_CHARACTERS = 2_000;
const DEFAULT_SEARCH_TYPE = "auto";
const DEFAULT_CONTENT_TYPE = "highlights";
const YEAR_PATTERN = /\b20\d{2}\b/;
const RECENCY_HINT_PATTERN =
  /\b(latest|current|today|recent|newest)\b|最新|最近|今天/i;

type ToolEventPayload = Record<string, unknown>;

type WebSearchToolContext = {
  onToolEvent?: (payload: ToolEventPayload) => void;
};

type ExaSearchResult = {
  title?: string;
  url?: string;
  publishedDate?: string;
  published_date?: string;
  text?: string;
  highlights?: string[];
  score?: number;
};

type ExaSearchResponse = {
  resolvedSearchType?: string;
  results?: ExaSearchResult[];
};

type NormalizedResult = {
  title: string;
  url: string;
  publishedDate: string;
  score: number | null;
  snippet: string;
};

export const webSearchSchema = z
  .object({
    query: z.string().min(1).describe("Search query."),
    type: z
      .enum(["auto", "fast", "deep"])
      .optional()
      .describe("Search type. Defaults to auto."),
    numResults: z
      .number()
      .int()
      .min(1)
      .max(25)
      .optional()
      .describe("Number of search results. Defaults to 8."),
    contentType: z
      .enum(["highlights", "text"])
      .optional()
      .describe("Content extraction mode. Defaults to highlights."),
    maxCharacters: z
      .number()
      .int()
      .min(200)
      .max(50_000)
      .optional()
      .describe("Maximum characters for content extraction."),
    livecrawl: z
      .enum(["fallback", "preferred"])
      .optional()
      .describe("Live crawling behavior."),
    includeDomains: z
      .array(z.string())
      .optional()
      .describe("Only include these domains."),
    excludeDomains: z
      .array(z.string())
      .optional()
      .describe("Exclude these domains."),
    category: z
      .union([
        z.enum(["news", "research paper", "tweet", "company", "people"]),
        z.null(),
      ])
      .optional()
      .describe("Optional category."),
    maxAgeHours: z
      .number()
      .int()
      .min(-1)
      .max(24 * 365)
      .optional()
      .describe("Cached-content freshness threshold in hours."),
  })
  .refine((value) => !(value.includeDomains && value.excludeDomains), {
    message: "includeDomains and excludeDomains cannot be used together.",
    path: ["includeDomains"],
  });

export function enrichQueryWithCurrentYear(query: string): string {
  if (!RECENCY_HINT_PATTERN.test(query) || YEAR_PATTERN.test(query)) {
    return query;
  }

  return `${query} ${new Date().getFullYear()}`;
}

function normalizeResults(data: ExaSearchResponse): NormalizedResult[] {
  return (data.results ?? []).map((item) => ({
    title: item.title ?? "Untitled result",
    url: item.url ?? "",
    publishedDate: item.publishedDate ?? item.published_date ?? "",
    score: typeof item.score === "number" ? item.score : null,
    snippet:
      item.text ??
      (Array.isArray(item.highlights)
        ? item.highlights.slice(0, 3).join(" ")
        : ""),
  }));
}

function formatResults(args: {
  originalQuery: string;
  executedQuery: string;
  resolvedSearchType: string;
  results: NormalizedResult[];
}): string {
  const { originalQuery, executedQuery, resolvedSearchType, results } = args;

  if (results.length === 0) {
    return [
      "联网搜索结果",
      `原始查询: ${originalQuery}`,
      `执行查询: ${executedQuery}`,
      `搜索类型: ${resolvedSearchType}`,
      `结果数: 0`,
      `未找到与“${originalQuery}”相关的结果。可以尝试更具体的关键词。`,
    ].join("\n");
  }

  const items = results.map((item, index) => {
    const lines = [`${index + 1}. ${item.title}`];

    if (item.url) {
      lines.push(`URL: ${item.url}`);
    }
    if (item.publishedDate) {
      lines.push(`发布日期: ${item.publishedDate}`);
    }
    if (item.score !== null) {
      lines.push(`相关性: ${item.score}`);
    }
    if (item.snippet) {
      lines.push(`摘要: ${item.snippet}`);
    }

    return lines.join("\n");
  });

  return [
    "联网搜索结果",
    `原始查询: ${originalQuery}`,
    `执行查询: ${executedQuery}`,
    `搜索类型: ${resolvedSearchType}`,
    `结果数: ${results.length}`,
    ...items,
  ].join("\n\n");
}

function emitToolEvent(
  onToolEvent: WebSearchToolContext["onToolEvent"],
  data: Record<string, unknown>,
) {
  onToolEvent?.({
    type: "tool_event",
    data: {
      tool: "web_search",
      ...data,
    },
  });
}

export function createWebSearchTool(context: WebSearchToolContext = {}) {
  const { onToolEvent } = context;

  return llm.tool({
    description: "使用 Exa 进行实时联网搜索，获取最新信息和来源链接。",
    parameters: webSearchSchema,
    execute: async (params) => {
      const apiKey = process.env.EXA_API_KEY;
      const executedQuery = enrichQueryWithCurrentYear(params.query);

      if (!apiKey) {
        emitToolEvent(onToolEvent, {
          event: "unavailable",
          query: params.query,
          reason: "missing_api_key",
        });
        return "联网搜索当前不可用：未配置 EXA_API_KEY。请联系管理员配置后再试。";
      }

      const contentType = params.contentType ?? DEFAULT_CONTENT_TYPE;
      const maxCharacters = params.maxCharacters ?? DEFAULT_MAX_CHARACTERS;
      const contents =
        contentType === "text"
          ? { text: { max_characters: maxCharacters } }
          : { highlights: { max_characters: maxCharacters } };

      const payload: Record<string, unknown> = {
        query: executedQuery,
        type: params.type ?? DEFAULT_SEARCH_TYPE,
        num_results: params.numResults ?? DEFAULT_NUM_RESULTS,
        contents,
      };

      if (params.livecrawl) payload.livecrawl = params.livecrawl;
      if (params.includeDomains) payload.includeDomains = params.includeDomains;
      if (params.excludeDomains) payload.excludeDomains = params.excludeDomains;
      if (params.category !== undefined) payload.category = params.category;
      if (params.maxAgeHours !== undefined)
        payload.maxAgeHours = params.maxAgeHours;

      emitToolEvent(onToolEvent, {
        event: "start",
        query: params.query,
        executedQuery,
      });

      try {
        const response = await fetch(EXA_SEARCH_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
          },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = (await response.text()).slice(0, 500);
          emitToolEvent(onToolEvent, {
            event: "error",
            query: params.query,
            status: response.status,
          });
          return `联网搜索失败（${response.status}）：${errorText || "上游服务异常，请稍后重试。"}`;
        }

        const data = (await response.json()) as ExaSearchResponse;
        const results = normalizeResults(data);
        emitToolEvent(onToolEvent, {
          event: "success",
          query: params.query,
          total: results.length,
        });

        return formatResults({
          originalQuery: params.query,
          executedQuery,
          resolvedSearchType: data.resolvedSearchType ?? String(payload.type),
          results,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emitToolEvent(onToolEvent, {
          event: "error",
          query: params.query,
          reason: message,
        });
        return `联网搜索失败：${message}`;
      }
    },
  });
}
