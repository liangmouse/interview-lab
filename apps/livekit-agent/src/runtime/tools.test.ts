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

    const startResult = await tools.code_assessment.execute(
      {
        action: "start",
        questionTitle: "Reverse Linked List",
        language: "javascript",
        description: "Given the head of a singly linked list, reverse it.",
        difficulty: "easy",
        solutionTemplate: "function reverseList(head) {}",
        testTemplate: "// tests",
      },
      {} as never,
    );
    expect(startResult).toContain("开启");
    expect(onToolEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "tool_event",
        data: expect.objectContaining({
          tool: "code_assessment",
          event: "start",
          questionTitle: "Reverse Linked List",
          language: "javascript",
          description: "Given the head of a singly linked list, reverse it.",
          difficulty: "easy",
          solutionTemplate: "function reverseList(head) {}",
          testTemplate: "// tests",
        }),
      }),
    );

    const endResult = await tools.code_assessment.execute(
      {
        action: "end",
        summary: "候选人完成了双指针解法",
      },
      {} as never,
    );
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

    const runResult = await tools.code_assessment.execute(
      {
        action: "run",
        language: "javascript",
        code: "function reverseList(head) { return head; }",
      },
      {} as never,
    );

    expect(runResult).toContain("执行");
    expect(runResult).toContain("javascript");
  });

  it("should gracefully degrade when web search is unavailable", async () => {
    const originalExaApiKey = process.env.EXA_API_KEY;
    delete process.env.EXA_API_KEY;

    const tools = createTools({ userProfile: mockProfile });
    const result = await tools.web_search.execute(
      {
        query: "latest AI news",
      },
      {} as never,
    );

    expect(result).toContain("未配置 EXA_API_KEY");

    if (originalExaApiKey === undefined) {
      delete process.env.EXA_API_KEY;
    } else {
      process.env.EXA_API_KEY = originalExaApiKey;
    }
  });

  // TODO: Add integration tests if possible, but for now we trust the extensive logic in tools.ts
  // The manual verification step in the plan covers dynamic invocation.

  describe("check_resume", () => {
    it("finds matching skills", async () => {
      const tools = createTools({ userProfile: mockProfile });
      const result = await tools.check_resume.execute(
        { query: "TypeScript", category: "skills" },
        {} as never,
      );
      expect(result).toContain("TypeScript");
    });

    it("finds matching work experience", async () => {
      const tools = createTools({ userProfile: mockProfile });
      const result = await tools.check_resume.execute(
        { query: "ByteDance", category: "work" },
        {} as never,
      );
      expect(result).toContain("ByteDance");
    });

    it("finds matching project by tech stack", async () => {
      const tools = createTools({ userProfile: mockProfile });
      const result = await tools.check_resume.execute(
        { query: "LangChain", category: "project" },
        {} as never,
      );
      expect(result).toContain("AI Agent");
    });

    it("returns not-found message for unknown query", async () => {
      const tools = createTools({ userProfile: mockProfile });
      const result = await tools.check_resume.execute(
        { query: "Kubernetes", category: "skills" },
        {} as never,
      );
      expect(result).toContain("未找到");
    });

    it("returns fallback when no userProfile provided", async () => {
      const tools = createTools({ userProfile: null });
      const result = await tools.check_resume.execute(
        { query: "React", category: "general" },
        {} as never,
      );
      expect(result).toContain("未找到简历信息");
    });
  });

  describe("record_score", () => {
    it("records score and returns confirmation", async () => {
      const tools = createTools({ userProfile: mockProfile });
      const result = await tools.record_score.execute(
        { criteria: "React Hooks", score: 8, reasoning: "清晰讲解了闭包问题" },
        {} as never,
      );
      expect(result).toContain("React Hooks");
      expect(result).toContain("8");
    });
  });
});
