import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchConversationHistory,
  saveMessage,
  DIRECTOR_BASE_URL,
} from "./utils";

describe("Utils", () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();
  const consoleSpy = {
    log: vi.spyOn(console, "log").mockImplementation(() => {}),
    warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
    error: vi.spyOn(console, "error").mockImplementation(() => {}),
  };

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    // Clear console spies
    consoleSpy.log.mockClear();
    consoleSpy.warn.mockClear();
    consoleSpy.error.mockClear();
  });

  afterEach(() => {
    vi.stubGlobal("fetch", originalFetch);
  });

  describe("fetchConversationHistory", () => {
    it("should return messages on successful response", async () => {
      const mockMessages = [
        { role: "user", content: "hello", timestamp: new Date().toISOString() },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ messages: mockMessages }),
      } as Response);

      const result = await fetchConversationHistory("test-id");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          `${DIRECTOR_BASE_URL}/api/interview/messages?interviewId=test-id`,
        ),
      );
      expect(result).toEqual(mockMessages);
    });

    it("should return empty array on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      const result = await fetchConversationHistory("test-id");

      expect(result).toEqual([]);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.stringContaining("获取失败"),
      );
    });

    it("should return empty array on fetch exception", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await fetchConversationHistory("test-id");

      expect(result).toEqual([]);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("获取失败"),
        expect.any(Error),
      );
    });
  });

  describe("saveMessage", () => {
    it("should post data correctly on success", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
      } as Response);

      await saveMessage("test-id", "user", "hello world");

      expect(mockFetch).toHaveBeenCalledWith(
        `${DIRECTOR_BASE_URL}/api/interview/messages`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            interviewId: "test-id",
            role: "user",
            content: "hello world",
          }),
        }),
      );
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("成功保存"),
      );
    });

    it("should log error on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      } as Response);

      await saveMessage("test-id", "user", "hello");

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("失败"),
      );
    });

    it("should log error on fetch exception", async () => {
      mockFetch.mockRejectedValue(new Error("Network failure"));

      await saveMessage("test-id", "user", "hello");

      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("请求失败"),
        expect.any(Error),
      );
    });
  });
});
