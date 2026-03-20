"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Lightbulb,
  Loader2,
  Play,
  Terminal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { CodeEditor } from "./code-editor";
import { useCodeRunner, type OutputLine } from "./use-code-runner";
import { DEFAULT_EDITOR_FILES, type CodeTabId } from "./code-editor-utils";

function OutputLineView({ line }: { line: OutputLine }) {
  const isPass = line.type === "log" && line.text.startsWith("✓");
  const isFail = line.type === "log" && line.text.startsWith("✗");

  return (
    <div
      className={cn(
        "mt-1 whitespace-pre-wrap break-all",
        isPass && "text-[#10B981]",
        isFail && "text-[#F87171]",
        !isPass && !isFail && line.type === "error" && "text-[#F87171]",
        !isPass && !isFail && line.type === "warn" && "text-[#FBBF24]",
        !isPass && !isFail && line.type === "log" && "text-[#AAAAAA]",
        !isPass && !isFail && line.type === "info" && "text-[#60A5FA]",
      )}
    >
      {line.text}
    </div>
  );
}

export function CodeWorkbench() {
  const t = useTranslations("interview");

  const [isQuestionExpanded, setIsQuestionExpanded] = useState(false);
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<CodeTabId>("solution");
  const [files, setFiles] = useState(DEFAULT_EDITOR_FILES);

  const { result, isRunning, run } = useCodeRunner();

  const handleChange = (tab: CodeTabId, value: string) => {
    setFiles((prev) => ({ ...prev, [tab]: value }));
  };

  const handleRun = () => {
    setIsConsoleExpanded(true);
    run(files.solution, files.test);
  };

  return (
    <div className="flex w-full h-full flex-col overflow-hidden bg-[#1E1E20]">
      {/* Problem header */}
      <div className="border-b border-l border-[#333333] bg-[#252527]">
        <div
          className="flex cursor-pointer items-center justify-between px-4 py-3"
          onClick={() => setIsQuestionExpanded(!isQuestionExpanded)}
        >
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-[#888888]">
              {t("problem", { number: 3 })}
            </span>
            <h3 className="text-base font-semibold text-[#E5E5E5]">
              Reverse Linked List
            </h3>
          </div>
          <div
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              size="sm"
              onClick={handleRun}
              disabled={isRunning}
              className="h-7 gap-1.5 bg-[#10B981] px-3 text-xs font-medium text-white hover:bg-[#059669] disabled:opacity-60"
            >
              {isRunning ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3 fill-current" />
              )}
              {isRunning ? t("running") : t("run")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsQuestionExpanded(!isQuestionExpanded)}
              className="text-[#888888] hover:text-[#E5E5E5]"
            >
              {isQuestionExpanded ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {isQuestionExpanded && (
          <div className="border-t border-[#333333] p-4 space-y-3">
            <p className="text-sm leading-relaxed text-[#AAAAAA]">
              Given the head of a singly linked list, reverse the list, and
              return the reversed list.
            </p>
            <div className="space-y-2">
              <p className="text-xs font-medium text-[#E5E5E5]">
                {t("example")}:
              </p>
              <pre className="rounded bg-[#1E1E20] p-3 text-xs text-[#AAAAAA]">
                Input: head = [1,2,3,4,5]{"\n"}
                Output: [5,4,3,2,1]
              </pre>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-[#888888] hover:text-[#10B981]"
            >
              <Lightbulb className="mr-2 h-4 w-4" />
              {t("showHint")}
            </Button>
          </div>
        )}
      </div>

      {/* Monaco Code Editor */}
      <div
        className={cn(
          "overflow-hidden border-l border-[#333333]",
          isConsoleExpanded ? "flex-[8]" : "flex-1",
        )}
      >
        <CodeEditor
          files={files}
          activeTab={activeTab}
          onTabChange={setActiveTab}
          onChange={handleChange}
        />
      </div>

      {/* Console output */}
      {isConsoleExpanded && (
        <div className="flex-[2] flex flex-col border-l border-t border-[#333333] bg-[#1E1E20]">
          <div className="flex shrink-0 items-center justify-between border-b border-[#333333] bg-[#252527] px-4 py-2">
            <div className="flex items-center gap-2 text-xs font-medium text-[#E5E5E5]">
              <Terminal className="h-3.5 w-3.5" />
              {t("terminal")}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsConsoleExpanded(false)}
              className="h-6 px-2 text-[#888888] hover:text-[#E5E5E5]"
            >
              <ChevronDown className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="flex-1 overflow-auto p-4 font-mono text-xs">
            {isRunning && (
              <div className="flex items-center gap-2 text-[#888888]">
                <Loader2 className="h-3 w-3 animate-spin" />
                Running...
              </div>
            )}
            {!isRunning && result && (
              <>
                <div className="text-[#10B981]">$ run test.js</div>
                {result.lines.map((line, i) => (
                  <OutputLineView key={i} line={line} />
                ))}
                {result.error && (
                  <div className="mt-1 text-[#F87171]">
                    ✗ Uncaught Error: {result.error}
                  </div>
                )}
                <div className="mt-2 text-[#555555]">
                  {t("executionCompleted", { time: `${result.duration}ms` })}
                </div>
              </>
            )}
            {!isRunning && !result && (
              <div className="text-[#555555]">
                Press <span className="text-[#10B981]">Run</span> to execute
                your code
              </div>
            )}
          </div>
        </div>
      )}

      {/* Restore console button */}
      {!isConsoleExpanded && (
        <button
          onClick={() => setIsConsoleExpanded(true)}
          className="border-l border-t border-[#333333] bg-[#252527] px-4 py-2 text-left text-xs font-medium text-[#888888] hover:text-[#E5E5E5]"
        >
          <Terminal className="mr-2 inline-block h-3.5 w-3.5" />
          {t("showTerminal")}
        </button>
      )}
    </div>
  );
}
