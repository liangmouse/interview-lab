"use client";

import { useState, useCallback } from "react";

export type OutputLine = {
  type: "log" | "error" | "warn" | "info";
  text: string;
};

export type RunResult = {
  lines: OutputLine[];
  duration: number;
  error?: string;
};

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

export function useCodeRunner() {
  const [result, setResult] = useState<RunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const run = useCallback((solution: string, test: string) => {
    setIsRunning(true);
    setResult(null);

    const blob = new Blob([WORKER_SCRIPT], { type: "application/javascript" });
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);

    const timer = setTimeout(() => {
      worker.terminate();
      URL.revokeObjectURL(url);
      setResult({
        lines: [
          {
            type: "error",
            text: `Execution timed out after ${TIMEOUT_MS / 1000}s`,
          },
        ],
        duration: TIMEOUT_MS,
        error: "Timeout",
      });
      setIsRunning(false);
    }, TIMEOUT_MS);

    worker.onmessage = (e: MessageEvent<RunResult>) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      setResult(e.data);
      setIsRunning(false);
    };

    worker.onerror = (e: ErrorEvent) => {
      clearTimeout(timer);
      worker.terminate();
      URL.revokeObjectURL(url);
      setResult({ lines: [], duration: 0, error: e.message });
      setIsRunning(false);
    };

    worker.postMessage({ solution, test });
  }, []);

  return { result, isRunning, run };
}
