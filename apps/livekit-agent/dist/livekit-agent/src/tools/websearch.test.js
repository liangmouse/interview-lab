import { afterEach, describe, expect, it, vi } from "vitest";
import { createWebSearchTool, enrichQueryWithCurrentYear, webSearchSchema, } from "./websearch";
describe("websearch tool", () => {
    const originalExaApiKey = process.env.EXA_API_KEY;
    afterEach(() => {
        vi.unstubAllGlobals();
        if (originalExaApiKey === undefined) {
            delete process.env.EXA_API_KEY;
        }
        else {
            process.env.EXA_API_KEY = originalExaApiKey;
        }
    });
    it("adds the current year for recent queries without a year", () => {
        expect(enrichQueryWithCurrentYear("latest AI news")).toBe("latest AI news 2026");
    });
    it("does not append a year when the query already contains one", () => {
        expect(enrichQueryWithCurrentYear("latest AI news 2025")).toBe("latest AI news 2025");
    });
    it("rejects includeDomains and excludeDomains together", () => {
        const result = webSearchSchema.safeParse({
            query: "TypeScript news",
            includeDomains: ["example.com"],
            excludeDomains: ["another.com"],
        });
        expect(result.success).toBe(false);
    });
    it("returns a graceful message when EXA_API_KEY is missing", async () => {
        delete process.env.EXA_API_KEY;
        const tool = createWebSearchTool();
        const result = await tool.execute({
            query: "latest TypeScript news",
        }, {});
        expect(result).toContain("未配置 EXA_API_KEY");
    });
    it("returns a graceful message when Exa responds with a non-2xx status", async () => {
        process.env.EXA_API_KEY = "test-key";
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            text: async () => "server exploded",
        }));
        const tool = createWebSearchTool();
        const result = await tool.execute({
            query: "latest TypeScript news",
        }, {});
        expect(result).toContain("联网搜索失败（500）");
        expect(result).toContain("server exploded");
    });
    it("returns a readable summary when Exa search succeeds", async () => {
        process.env.EXA_API_KEY = "test-key";
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                resolvedSearchType: "auto",
                results: [
                    {
                        title: "TypeScript 5.9 released",
                        url: "https://example.com/typescript-5-9",
                        publishedDate: "2026-03-01T00:00:00.000Z",
                        score: 0.99,
                        highlights: ["TypeScript 5.9 improves inference."],
                    },
                ],
            }),
        }));
        const tool = createWebSearchTool();
        const result = await tool.execute({
            query: "latest TypeScript release",
        }, {});
        expect(result).toContain("原始查询: latest TypeScript release");
        expect(result).toContain("执行查询: latest TypeScript release 2026");
        expect(result).toContain("TypeScript 5.9 released");
        expect(result).toContain("https://example.com/typescript-5-9");
    });
});
