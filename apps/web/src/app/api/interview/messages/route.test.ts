// Define mocks before import
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
// Hoist mocks
const { mockFrom, mockRpc, mockSupabase } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  const mockRpc = vi.fn();
  const mockSupabase = {
    from: mockFrom,
    rpc: mockRpc,
  };
  return { mockFrom, mockRpc, mockSupabase };
});

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockOrder = vi.fn();
const mockEq = vi.fn();

// Mock createClient
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => mockSupabase,
}));

import { GET, POST } from "./route";

describe("Messages API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key";

    // Chain mocks
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      order: mockOrder,
    });

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("GET", () => {
    it("should return 400 if interviewId is missing", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/interview/messages",
      );
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Missing interviewId");
    });

    it("should return 200 and messages on success", async () => {
      const mockData = [{ id: 1, content: "hello" }];
      mockOrder.mockResolvedValue({ data: mockData, error: null });

      const req = new NextRequest(
        "http://localhost:3000/api/interview/messages?interviewId=123",
      );
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.messages).toEqual(mockData);
      expect(mockFrom).toHaveBeenCalledWith("messages");
      expect(mockEq).toHaveBeenCalledWith("interview_id", "123");
    });

    it("should return 500 on database error", async () => {
      mockOrder.mockResolvedValue({
        data: null,
        error: { message: "DB Error" },
      });

      const req = new NextRequest(
        "http://localhost:3000/api/interview/messages?interviewId=123",
      );
      const res = await GET(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("DB Error");
    });
  });

  describe("POST", () => {
    it("should return 400 if fields are missing", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/interview/messages",
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Missing fields");
    });

    it("should return 200 on successful insert", async () => {
      mockRpc.mockResolvedValue({ error: null });

      const payload = {
        interviewId: "123",
        role: "user",
        content: "hello",
      };

      const req = new NextRequest(
        "http://localhost:3000/api/interview/messages",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(mockRpc).toHaveBeenCalledWith("add_user_message", {
        p_interview_id: "123",
        p_content: "hello",
      });
    });

    it("should save assistant messages through the ai message rpc", async () => {
      mockRpc.mockResolvedValue({ error: null });

      const req = new NextRequest(
        "http://localhost:3000/api/interview/messages",
        {
          method: "POST",
          body: JSON.stringify({
            interviewId: "123",
            role: "assistant",
            content: "你好",
          }),
        },
      );
      const res = await POST(req);

      expect(res.status).toBe(200);
      expect(mockRpc).toHaveBeenCalledWith("add_ai_message", {
        p_interview_id: "123",
        p_content: "你好",
      });
    });

    it("should return 400 if role is invalid", async () => {
      const req = new NextRequest(
        "http://localhost:3000/api/interview/messages",
        {
          method: "POST",
          body: JSON.stringify({
            interviewId: "123",
            role: "system",
            content: "hello",
          }),
        },
      );
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(400);
      expect(data.error).toBe("Invalid role");
    });

    it("should return 500 on insert error", async () => {
      mockRpc.mockResolvedValue({ error: { message: "Insert Failed" } });

      const payload = {
        interviewId: "123",
        role: "user",
        content: "hello",
      };

      const req = new NextRequest(
        "http://localhost:3000/api/interview/messages",
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      const res = await POST(req);
      const data = await res.json();

      expect(res.status).toBe(500);
      expect(data.error).toBe("Insert Failed");
    });
  });
});
