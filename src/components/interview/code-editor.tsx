"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  CODE_TABS,
  DEFAULT_EDITOR_FILES,
  type CodeTabId,
  getEditorLineNumbers,
} from "./code-editor-utils";

export function CodeEditor() {
  const [activeTab, setActiveTab] = useState<CodeTabId>("solution");
  const [files, setFiles] = useState(DEFAULT_EDITOR_FILES);
  const activeCode = files[activeTab];
  const lineNumbers = getEditorLineNumbers(activeCode);

  const handleCodeChange = (nextCode: string) => {
    setFiles((prev) => ({ ...prev, [activeTab]: nextCode }));
  };

  return (
    <div className="flex h-full flex-col bg-[#0B1220]">
      {/* Tab Bar */}
      <div className="flex border-b border-[#1F2937] bg-[#0F172A]">
        {CODE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "border-r border-[#1F2937] px-4 py-2.5 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "bg-[#111827] text-[#F8FAFC]"
                : "text-[#94A3B8] hover:bg-[#111827] hover:text-[#E2E8F0]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Editor Area */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="w-12 shrink-0 overflow-hidden border-r border-[#1F2937] bg-[#0F172A] px-1 py-4">
          {lineNumbers.map((lineNumber) => (
            <div
              key={lineNumber}
              className="font-mono text-xs leading-6 text-[#475569] text-right"
            >
              {lineNumber}
            </div>
          ))}
        </div>
        <textarea
          value={activeCode}
          onChange={(event) => handleCodeChange(event.target.value)}
          spellCheck={false}
          className="h-full w-full resize-none bg-transparent p-4 font-mono text-sm leading-6 text-[#E2E8F0] outline-none"
        />
      </div>
    </div>
  );
}
