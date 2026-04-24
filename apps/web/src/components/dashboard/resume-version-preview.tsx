"use client";

import ReactMarkdown from "react-markdown";
import type { ResumeVersion } from "@interviewclaw/domain";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import styles from "./resume-version-preview.module.css";

export function ResumeVersionPreview({ version }: { version: ResumeVersion }) {
  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div>
          <p className="text-lg font-semibold text-[#141414]">
            {version.title}
          </p>
          <div className={styles.meta}>
            <span>{version.language === "en-US" ? "英文版" : "中文版"}</span>
            <span>{version.directionPreset}</span>
            <span>{version.createdAt.slice(0, 10)}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="outline" className="cursor-pointer">
            <Link href="/resume-generation">返回工坊</Link>
          </Button>
          <Button
            onClick={() => window.print()}
            className="cursor-pointer bg-[#141414] text-white hover:bg-[#222]"
          >
            导出 PDF
          </Button>
        </div>
      </div>

      <div className={styles.shell}>
        <div className={styles.paper}>
          <div className={styles.hero}>
            <h1>{version.title}</h1>
            <p>{version.summary}</p>
          </div>
          <article className={styles.markdown}>
            <ReactMarkdown>{version.markdownContent}</ReactMarkdown>
          </article>
        </div>
      </div>
    </div>
  );
}
