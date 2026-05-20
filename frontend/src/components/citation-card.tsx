import { FileText } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Citation } from "@/types";

interface CitationPillProps {
  citation: Citation;
  index: number;
  active?: boolean;
  onClick?: () => void;
}

export function CitationPill({ citation, index, active = false, onClick }: CitationPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={citation.snippet}
      className={cn(
        "group inline-flex max-w-[18rem] items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition",
        active
          ? "border-blue-300 bg-blue-50 text-blue-700"
          : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50/60 hover:text-blue-700",
      )}
    >
      <span
        className={cn(
          "inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-semibold",
          active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-500 group-hover:bg-blue-100 group-hover:text-blue-700",
        )}
      >
        {index + 1}
      </span>
      <FileText className="h-3 w-3 shrink-0 opacity-70" />
      <span className="truncate font-medium">{citation.document}</span>
      {citation.page ? <span className="shrink-0 opacity-70">· p.{citation.page}</span> : null}
    </button>
  );
}
