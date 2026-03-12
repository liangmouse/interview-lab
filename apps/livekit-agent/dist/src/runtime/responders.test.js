import { describe, it, expect, vi } from "vitest";
import { createUserTextResponder } from "./responders";
describe("runtime/responders.createUserTextResponder", () => {
    it("ignores blank input", async () => {
        const session = { generateReply: vi.fn() };
        const respond = createUserTextResponder({ session: session });
        await respond("   ");
        expect(session.generateReply).not.toHaveBeenCalled();
    });
    it("calls session.generateReply with trimmed userInput", async () => {
        const session = { generateReply: vi.fn() };
        const respond = createUserTextResponder({ session: session });
        await respond("  你好  ");
        expect(session.generateReply).toHaveBeenCalledWith({
            userInput: "你好",
            allowInterruptions: false,
        });
    });
});
