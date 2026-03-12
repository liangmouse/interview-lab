"use client";

import { cn } from "@/lib/utils";

import { useState } from "react";
import { ChevronDown, ChevronUp, Lightbulb, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CodeEditor } from "./code-editor";
import { useTranslations } from "next-intl";

export function CodeWorkbench() {
  const t = useTranslations("interview");
  const [isQuestionExpanded, setIsQuestionExpanded] = useState(false);
  const [isConsoleExpanded, setIsConsoleExpanded] = useState(true);

  return (
    <div className="flex w-full h-full flex-col overflow-hidden bg-[#1E1E20]">
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
          <Button
            variant="ghost"
            size="sm"
            className="text-[#888888] hover:text-[#E5E5E5]"
          >
            {isQuestionExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
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

      {/* Code Editor - Takes 80% of remaining space when console is open */}
      <div
        className={cn(
          "overflow-hidden border-l border-[#333333]",
          isConsoleExpanded ? "flex-[8]" : "flex-1",
        )}
      >
        <CodeEditor />
      </div>

      {isConsoleExpanded && (
        <div className="flex-[2] border-l border-t border-[#333333] bg-[#1E1E20]">
          <div className="flex items-center justify-between border-b border-[#333333] bg-[#252527] px-4 py-2">
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
          <div className="h-full overflow-auto p-4 font-mono text-xs text-[#AAAAAA]">
            <div className="text-[#10B981]">$ node solution.js</div>
            <div className="mt-1">
              {"{ val: 5, next: { val: 4, next: { val: 3, next: null } } }"}
            </div>
            <div className="mt-2 text-[#888888]">
              {t("executionCompleted", { time: "0.12s" })}
            </div>
          </div>
        </div>
      )}

      {/* Restore console button when collapsed */}
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
