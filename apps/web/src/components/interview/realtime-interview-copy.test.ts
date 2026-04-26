import { describe, expect, it } from "vitest";
import { REALTIME_INTERVIEW_IDLE_COPY } from "./realtime-interview-copy";

describe("REALTIME_INTERVIEW_IDLE_COPY", () => {
  it("includes self-introduction guidance before interview start", () => {
    expect(REALTIME_INTERVIEW_IDLE_COPY.hero).toContain("自我介绍");
    expect(REALTIME_INTERVIEW_IDLE_COPY.footer).toContain("自我介绍");
  });
});
