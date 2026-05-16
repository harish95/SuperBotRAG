import { FileText } from "lucide-react";

import { Card } from "@/components/ui/card";
import type { Citation } from "@/types";

export function CitationCard({ citation }: { citation: Citation }) {
  return (
    <Card className="border-slate-200 bg-slate-50 p-4 shadow-none">
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-white p-2 shadow-sm">
          <FileText className="h-4 w-4 text-blue-600" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-slate-900">{citation.document}</p>
            {citation.page ? (
              <span className="text-xs text-slate-500">Page {citation.page}</span>
            ) : null}
          </div>
          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{citation.snippet}</p>
        </div>
      </div>
    </Card>
  );
}
