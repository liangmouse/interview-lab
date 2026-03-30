"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";

const PDF_JS_MODULE_URL = "/vendor/pdfjs/pdf.min.mjs";
const PDF_JS_WORKER_URL = "/vendor/pdfjs/pdf.worker.min.mjs";
const HORIZONTAL_PADDING = 24;
const MIN_PAGE_WIDTH = 280;
const WIDTH_CHANGE_THRESHOLD = 8;
const RESIZE_SETTLE_MS = 120;
const MAX_DEVICE_PIXEL_RATIO = 1.5;
const PREFETCHED_PAGE_COUNT = 2;

type PdfJsViewport = {
  width: number;
  height: number;
};

type PdfJsRenderTask = {
  promise: Promise<void>;
  cancel?: () => void;
};

type PdfJsPageProxy = {
  getViewport: (options: { scale: number }) => PdfJsViewport;
  render: (options: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PdfJsViewport;
  }) => PdfJsRenderTask;
  cleanup?: () => void;
};

type PdfJsDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPageProxy>;
  destroy?: () => Promise<void> | void;
};

type PdfJsLoadingTask = {
  promise: Promise<PdfJsDocumentProxy>;
  destroy?: () => void;
};

type PdfJsModule = {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (
    source:
      | string
      | {
          url: string;
          withCredentials?: boolean;
        },
  ) => PdfJsLoadingTask;
};

type PdfJsLoader = () => Promise<PdfJsModule>;

interface InterviewResumePdfViewerProps {
  resumeUrl: string;
  pdfJsLoader?: PdfJsLoader;
}

function loadPdfJsModule() {
  return import(
    /* webpackIgnore: true */
    PDF_JS_MODULE_URL
  ) as Promise<PdfJsModule>;
}

function ResumePageSkeleton({ height = 420 }: { height?: number }) {
  return (
    <div className="w-full max-w-[920px] overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div
        className="animate-pulse rounded-xl bg-[#E2E8F0]"
        style={{ height }}
      />
    </div>
  );
}

function ResumeErrorState() {
  return (
    <div className="rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3 text-sm text-[#B91C1C]">
      简历预览加载失败，请尝试在右上角新标签页中打开。
    </div>
  );
}

function ResumePdfPage({
  documentProxy,
  pageNumber,
  width,
}: {
  documentProxy: PdfJsDocumentProxy;
  pageNumber: number;
  width: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [canvasHeight, setCanvasHeight] = useState<number | null>(null);
  const [isVisible, setIsVisible] = useState(
    pageNumber <= PREFETCHED_PAGE_COUNT,
  );
  const [hasRenderedOnce, setHasRenderedOnce] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );

  useEffect(() => {
    if (isVisible) {
      return;
    }

    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      {
        rootMargin: "240px 0px",
      },
    );

    observer.observe(host);

    return () => {
      observer.disconnect();
    };
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    let cancelled = false;
    let renderTask: PdfJsRenderTask | null = null;
    let pageProxy: PdfJsPageProxy | null = null;

    async function renderPage() {
      try {
        setStatus("loading");

        pageProxy = await documentProxy.getPage(pageNumber);
        if (cancelled) {
          return;
        }

        const baseViewport = pageProxy.getViewport({ scale: 1 });
        const scale = width / baseViewport.width;
        const viewport = pageProxy.getViewport({ scale });
        const canvas = canvasRef.current;

        if (!canvas) {
          return;
        }

        const context = canvas.getContext("2d");
        if (!context) {
          setStatus("error");
          return;
        }

        const devicePixelRatio = Math.min(
          window.devicePixelRatio || 1,
          MAX_DEVICE_PIXEL_RATIO,
        );

        canvas.width = Math.round(viewport.width * devicePixelRatio);
        canvas.height = Math.round(viewport.height * devicePixelRatio);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;

        context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
        context.clearRect(0, 0, viewport.width, viewport.height);

        renderTask = pageProxy.render({
          canvasContext: context,
          viewport,
        });

        await renderTask.promise;

        if (cancelled) {
          return;
        }

        setCanvasHeight(viewport.height);
        setHasRenderedOnce(true);
        setStatus("ready");
      } catch (error) {
        const errorName =
          error instanceof Error ? error.name : "UnknownRenderError";

        if (cancelled || errorName === "RenderingCancelledException") {
          return;
        }

        console.error("Failed to render resume pdf page:", error);
        setStatus("error");
      }
    }

    void renderPage();

    return () => {
      cancelled = true;
      renderTask?.cancel?.();
      pageProxy?.cleanup?.();
    };
  }, [documentProxy, isVisible, pageNumber, width]);

  return (
    <div
      ref={hostRef}
      className="w-full overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
      style={{ minHeight: canvasHeight ?? 420 }}
    >
      {!hasRenderedOnce ? (
        status === "error" ? (
          <div className="p-4">
            <ResumeErrorState />
          </div>
        ) : (
          <ResumePageSkeleton height={canvasHeight ?? 420} />
        )
      ) : null}

      <canvas
        ref={canvasRef}
        className={status === "error" && !hasRenderedOnce ? "hidden" : "block"}
        data-page-number={pageNumber}
        data-testid={`page-canvas-${pageNumber}`}
      />
    </div>
  );
}

export function InterviewResumePdfViewer({
  resumeUrl,
  pdfJsLoader = loadPdfJsModule,
}: InterviewResumePdfViewerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resizeFrameRef = useRef<number | null>(null);
  const resizeTimerRef = useRef<ReturnType<typeof window.setTimeout> | null>(
    null,
  );
  const activeTaskRef = useRef<PdfJsLoadingTask | null>(null);
  const activeDocumentRef = useRef<PdfJsDocumentProxy | null>(null);

  const [containerWidth, setContainerWidth] = useState(0);
  const [documentProxy, setDocumentProxy] = useState<PdfJsDocumentProxy | null>(
    null,
  );
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") {
      return;
    }

    const commitWidth = (nextWidth: number) => {
      if (!nextWidth) {
        return;
      }

      setContainerWidth((currentWidth) =>
        Math.abs(currentWidth - nextWidth) >= WIDTH_CHANGE_THRESHOLD
          ? nextWidth
          : currentWidth,
      );
    };

    const scheduleCommit = (width?: number) => {
      const nextWidth = Math.round(
        width ?? container.getBoundingClientRect().width,
      );

      if (resizeFrameRef.current) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }

      resizeFrameRef.current = window.requestAnimationFrame(() => {
        if (resizeTimerRef.current) {
          window.clearTimeout(resizeTimerRef.current);
        }

        resizeTimerRef.current = window.setTimeout(() => {
          commitWidth(nextWidth);
        }, RESIZE_SETTLE_MS);
      });
    };

    scheduleCommit();

    const observer = new ResizeObserver((entries) => {
      scheduleCommit(entries[0]?.contentRect.width);
    });

    observer.observe(container);

    return () => {
      observer.disconnect();
      if (resizeFrameRef.current) {
        window.cancelAnimationFrame(resizeFrameRef.current);
      }
      if (resizeTimerRef.current) {
        window.clearTimeout(resizeTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");
    setDocumentProxy(null);

    activeTaskRef.current?.destroy?.();

    void (async () => {
      try {
        const pdfJsModule = await pdfJsLoader();
        if (cancelled) {
          return;
        }

        pdfJsModule.GlobalWorkerOptions.workerSrc = PDF_JS_WORKER_URL;

        const loadingTask = pdfJsModule.getDocument({
          url: resumeUrl,
        });

        activeTaskRef.current = loadingTask;

        const nextDocumentProxy = await loadingTask.promise;
        if (cancelled) {
          await nextDocumentProxy.destroy?.();
          return;
        }

        activeDocumentRef.current?.destroy?.();
        activeDocumentRef.current = nextDocumentProxy;
        setDocumentProxy(nextDocumentProxy);
        setStatus("ready");
      } catch (error) {
        if (cancelled) {
          return;
        }

        console.error("Failed to load resume pdf document:", error);
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      activeTaskRef.current?.destroy?.();
    };
  }, [pdfJsLoader, resumeUrl]);

  useEffect(() => {
    return () => {
      activeDocumentRef.current?.destroy?.();
    };
  }, []);

  const pageWidth = useMemo(
    () =>
      Math.max(MIN_PAGE_WIDTH, Math.round(containerWidth - HORIZONTAL_PADDING)),
    [containerWidth],
  );

  return (
    <div ref={containerRef} className="h-full min-w-0">
      <ScrollArea className="h-full w-full">
        <div className="flex min-h-full justify-center px-3 py-4">
          {status === "error" ? (
            <ResumeErrorState />
          ) : status !== "ready" || !documentProxy || containerWidth === 0 ? (
            <ResumePageSkeleton />
          ) : (
            <div className="flex w-full flex-col items-center gap-4">
              {Array.from({ length: documentProxy.numPages }, (_, index) => (
                <ResumePdfPage
                  key={`resume-page-${index + 1}`}
                  documentProxy={documentProxy}
                  pageNumber={index + 1}
                  width={pageWidth}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
