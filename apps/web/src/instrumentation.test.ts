import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { registerNodeInstrumentationMock } = vi.hoisted(() => ({
  registerNodeInstrumentationMock: vi.fn(),
}));

vi.mock("./instrumentation-node", () => ({
  registerNodeInstrumentation: registerNodeInstrumentationMock,
}));

import { register } from "./instrumentation";

describe("web instrumentation register", () => {
  const savedRuntime = process.env.NEXT_RUNTIME;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    registerNodeInstrumentationMock.mockReset();
    consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    if (savedRuntime === undefined) {
      delete process.env.NEXT_RUNTIME;
    } else {
      process.env.NEXT_RUNTIME = savedRuntime;
    }

    consoleErrorSpy.mockRestore();
  });

  it("skips node instrumentation outside the node runtime", async () => {
    process.env.NEXT_RUNTIME = "edge";

    await register();

    expect(registerNodeInstrumentationMock).not.toHaveBeenCalled();
  });

  it("initializes node instrumentation in the node runtime", async () => {
    process.env.NEXT_RUNTIME = "nodejs";

    await register();

    expect(registerNodeInstrumentationMock).toHaveBeenCalledTimes(1);
  });

  it("logs and continues when node instrumentation initialization fails", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const error = new Error("boom");
    registerNodeInstrumentationMock.mockRejectedValueOnce(error);

    await expect(register()).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[instrumentation] failed to initialize node telemetry",
      error,
    );
  });
});
