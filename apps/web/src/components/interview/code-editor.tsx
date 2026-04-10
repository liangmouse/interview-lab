"use client";

import dynamic from "next/dynamic";
import { cn } from "@/lib/utils";
import { CODE_TABS, type CodeTabId } from "./code-editor-utils";

// Monaco is ~2 MB; load client-side only to keep initial bundle small
const MonacoEditor = dynamic(
  () => import("@monaco-editor/react").then((m) => m.default),
  {
    ssr: false,
    loading: () => <div className="flex-1 bg-[#1E1E1E]" />,
  },
);

type Props = {
  files: Record<CodeTabId, string>;
  activeTab: CodeTabId;
  language?: "javascript" | "typescript" | "python";
  onTabChange: (tab: CodeTabId) => void;
  onChange: (tab: CodeTabId, value: string) => void;
};

export function CodeEditor({
  files,
  activeTab,
  language = "javascript",
  onTabChange,
  onChange,
}: Props) {
  return (
    <div className="flex h-full flex-col bg-[#0B1220]">
      {/* Tab Bar */}
      <div className="flex border-b border-[#1F2937] bg-[#0F172A]">
        {CODE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "border-r border-[#1F2937] px-4 py-2.5 text-xs font-medium transition-colors",
              activeTab === tab.id
                ? "bg-[#1E1E1E] text-[#F8FAFC]"
                : "text-[#94A3B8] hover:bg-[#1E1E1E] hover:text-[#E2E8F0]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Monaco Editor — controlled; swap content on tab change without unmounting */}
      <div className="flex-1 overflow-hidden">
        <MonacoEditor
          height="100%"
          language={language}
          theme="vs-dark"
          value={files[activeTab]}
          path={activeTab}
          onChange={(value) => onChange(activeTab, value ?? "")}
          options={{
            fontSize: 13,
            lineHeight: 24,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: "on",
            tabSize: 2,
            renderLineHighlight: "line",
            overviewRulerBorder: false,
            hideCursorInOverviewRuler: true,
            padding: { top: 16, bottom: 16 },
            fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, monospace",
            fontLigatures: true,
          }}
        />
      </div>
    </div>
  );
}
