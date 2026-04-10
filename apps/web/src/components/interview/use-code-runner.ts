"use client";

import { useState, useCallback } from "react";
import type { CodeRunResult, OutputLine } from "./code-editor-utils";

export type RunResult = CodeRunResult;
export type { OutputLine };

// Runs inside an isolated Web Worker — no DOM access, captures console output
const WORKER_SCRIPT = `
self.onmessage = function (e) {
  var solution = e.data.solution;
  var test = e.data.test;
  var lines = [];

  function capture(type) {
    return function () {
      var text = Array.prototype.slice.call(arguments).map(function (a) {
        if (a === null) return 'null';
        if (a === undefined) return 'undefined';
        if (typeof a === 'object') {
          try { return JSON.stringify(a); } catch (_) { return String(a); }
        }
        return String(a);
      }).join(' ');
      lines.push({ type: type, text: text });
    };
  }

  var _log   = console.log;
  var _error = console.error;
  var _warn  = console.warn;
  var _info  = console.info;
  console.log   = capture('log');
  console.error = capture('error');
  console.warn  = capture('warn');
  console.info  = capture('info');

  var start = Date.now();
  try {
    new Function(solution + '\\n' + test)();
    self.postMessage({ lines: lines, duration: Date.now() - start });
  } catch (err) {
    self.postMessage({ lines: lines, duration: Date.now() - start, error: err.message });
  } finally {
    console.log   = _log;
    console.error = _error;
    console.warn  = _warn;
    console.info  = _info;
  }
};
`;

const TIMEOUT_MS = 5000;

export function executeCodeRun(
  solution: string,
  test: string,
  timeoutMs: number = TIMEOUT_MS,
) {
  return new Promise<CodeRunResult>((resolve) => {
    const blob = new Blob([WORKER_SCRIPT], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    const timer = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({
        lines: [
          {
            type: "error",
            text: `Execution timed out after ${timeoutMs / 1000}s`,
          },
        ],
        duration: timeoutMs,
        error: "Timeout",
      });
    }, timeoutMs);

    worker.onmessage = (e: MessageEvent<CodeRunResult>) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve(e.data);
    };

    worker.onerror = (e: ErrorEvent) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      resolve({ lines: [], duration: 0, error: e.message });
    };

    worker.postMessage({ solution, test });
  });
}

export function useCodeRunner() {
  const [result, setResult] = useState<CodeRunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const run = useCallback(async (solution: string, test: string) => {
    setIsRunning(true);
    setResult(null);
    const nextResult = await executeCodeRun(solution, test);
    setResult(nextResult);
    setIsRunning(false);
  }, []);

  return { result, isRunning, run };
}
