import { describe, it, expect, vi } from "vitest";
import { createTools } from "./tools";
describe("Tool Functions", () => {
    const mockProfile = {
        skills: ["React", "TypeScript", "Node.js"],
        work_experiences: [
            {
                company: "ByteDance",
                position: "Frontend Engineer",
                description: "Built awesome UI",
            },
        ],
        project_experiences: [
            {
                project_name: "AI Agent",
                role: "Lead",
                tech_stack: ["Python", "LangChain"],
            },
        ],
    };
    // We can't easily test the execution without mocking the context registration deeply,
    // but we can check if it returns a context.
    it("should create tools object", () => {
        const tools = createTools({ userProfile: mockProfile });
        expect(tools).toBeDefined();
        expect(tools.web_search).toBeDefined();
        expect(tools.record_score).toBeDefined();
        expect(tools.check_resume).toBeDefined();
        expect(tools.code_assessment).toBeDefined();
    });
    it("should emit start/end tool events for code assessment", async () => {
        const onToolEvent = vi.fn();
        const tools = createTools({ userProfile: mockProfile, onToolEvent });
        const startResult = await tools.code_assessment.execute({
            action: "start",
            questionTitle: "Reverse Linked List",
            language: "javascript",
        }, {});
        expect(startResult).toContain("开启");
        expect(onToolEvent).toHaveBeenCalledWith({
            type: "tool_event",
            data: {
                tool: "code_assessment",
                event: "start",
                questionTitle: "Reverse Linked List",
                language: "javascript",
            },
        });
        const endResult = await tools.code_assessment.execute({
            action: "end",
            summary: "候选人完成了双指针解法",
        }, {});
        expect(endResult).toContain("结束");
        expect(onToolEvent).toHaveBeenCalledWith({
            type: "tool_event",
            data: {
                tool: "code_assessment",
                event: "end",
                summary: "候选人完成了双指针解法",
            },
        });
    });
    it("should return run feedback for code assessment run action", async () => {
        const tools = createTools({ userProfile: mockProfile });
        const runResult = await tools.code_assessment.execute({
            action: "run",
            language: "javascript",
            code: "function reverseList(head) { return head; }",
        }, {});
        expect(runResult).toContain("执行");
        expect(runResult).toContain("javascript");
    });
    it("should gracefully degrade when web search is unavailable", async () => {
        const originalExaApiKey = process.env.EXA_API_KEY;
        delete process.env.EXA_API_KEY;
        const tools = createTools({ userProfile: mockProfile });
        const result = await tools.web_search.execute({
            query: "latest AI news",
        }, {});
        expect(result).toContain("未配置 EXA_API_KEY");
        if (originalExaApiKey === undefined) {
            delete process.env.EXA_API_KEY;
        }
        else {
            process.env.EXA_API_KEY = originalExaApiKey;
        }
    });
    // TODO: Add integration tests if possible, but for now we trust the extensive logic in tools.ts
    // The manual verification step in the plan covers dynamic invocation.
});
