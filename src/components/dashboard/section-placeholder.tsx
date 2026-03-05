import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";

interface SectionPlaceholderProps {
  title: string;
  description: string;
  actionLabel: string;
  headerExtra?: ReactNode;
}

export function SectionPlaceholder({
  title,
  description,
  actionLabel,
  headerExtra,
}: SectionPlaceholderProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-10 shadow-sm">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {headerExtra ? <div className="shrink-0">{headerExtra}</div> : null}
        </div>
        <p className="max-w-2xl text-muted-foreground">{description}</p>
        <div className="pt-2">
          <Button asChild>
            <Link href="/dashboard">{actionLabel}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
