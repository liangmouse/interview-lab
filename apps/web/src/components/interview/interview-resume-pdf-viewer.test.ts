// @vitest-environment jsdom

import React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InterviewResumePdfViewer } from "./interview-resume-pdf-viewer";

vi.stubGlobal("React", React);

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children?: React.ReactNode }) =>
    React.createElement("div", { "data-testid": "scroll-area" }, children),
}));

class ResizeObserverMock {
  static instances: ResizeObserverMock[] = [];

  constructor(private readonly callback: ResizeObserverCallback) {
    ResizeObserverMock.instances.push(this);
  }

  observe = vi.fn();

  disconnect = vi.fn();

  trigger(width: number) {
    this.callback(
      [
        {
          contentRect: {
            width,
          },
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
}

class IntersectionObserverMock {
  observe = vi.fn();

  disconnect = vi.fn();

  unobserve = vi.fn();
}

describe("InterviewResumePdfViewer", () => {
  const originalGetBoundingClientRect =
    HTMLElement.prototype.getBoundingClientRect;

  beforeEach(() => {
    ResizeObserverMock.instances = [];

    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    vi.stubGlobal("IntersectionObserver", IntersectionObserverMock);
    vi.stubGlobal("requestAnimationFrame", ((
      callback: FrameRequestCallback,
    ) => {
      queueMicrotask(() => callback(performance.now()));
      return 1;
    }) as typeof window.requestAnimationFrame);
    vi.stubGlobal(
      "cancelAnimationFrame",
      (() => undefined) as typeof window.cancelAnimationFrame,
    );

    HTMLElement.prototype.getBoundingClientRect =
      function getBoundingClientRect() {
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 640,
          bottom: 400,
          width: 640,
          height: 400,
          toJSON: () => "",
        };
      };

    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
      setTransform: vi.fn(),
      clearRect: vi.fn(),
    })) as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  });

  it("updates rendered canvas width after container resize settles", async () => {
    const renderSpy = vi.fn().mockImplementation(({ viewport }) => ({
      promise: Promise.resolve().then(() => {
        const canvas = screen.getByTestId("page-canvas-1");
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
      }),
      cancel: vi.fn(),
    }));

    const pdfJsLoader = vi.fn().mockResolvedValue({
      GlobalWorkerOptions: {
        workerSrc: "",
      },
      getDocument: () => ({
        promise: Promise.resolve({
          numPages: 1,
          getPage: async () => ({
            getViewport: ({ scale }: { scale: number }) => ({
              width: 500 * scale,
              height: 700 * scale,
            }),
            render: renderSpy,
            cleanup: vi.fn(),
          }),
          destroy: vi.fn(),
        }),
        destroy: vi.fn(),
      }),
    });

    render(
      React.createElement(InterviewResumePdfViewer, {
        resumeUrl: "https://example.com/resume.pdf",
        pdfJsLoader,
      }),
    );

    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 140));
    });

    await waitFor(() => {
      expect(renderSpy).toHaveBeenCalled();
    });

    expect(screen.getByTestId("page-canvas-1")).toHaveStyle({
      width: "616px",
    });

    await act(async () => {
      ResizeObserverMock.instances[0]?.trigger(420);
      await new Promise((resolve) => window.setTimeout(resolve, 140));
    });

    await waitFor(() => {
      expect(screen.getByTestId("page-canvas-1")).toHaveStyle({
        width: "396px",
      });
    });
  });
});
