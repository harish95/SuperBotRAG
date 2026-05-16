import { Clock3, FileText, Layers3 } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { StatusBadge } from "@/components/status-badge";
import { formatDateTime } from "@/lib/utils";
import type { UploadEntry } from "@/types";

export function UploadCard({ upload }: { upload: UploadEntry }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-blue-50 p-2 text-blue-600">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="truncate font-medium text-slate-900">{upload.filename}</p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(upload.upload_time)}</p>
            </div>
          </div>
        </div>
        <StatusBadge status={upload.status} />
      </div>

      <div className="mt-4 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
        <div className="flex items-center gap-2">
          <Layers3 className="h-4 w-4 text-slate-400" />
          <span>{upload.chunk_count} chunks</span>
        </div>
        <div className="flex items-center gap-2">
          <Clock3 className="h-4 w-4 text-slate-400" />
          <span>{upload.progress ?? 0}% uploaded</span>
        </div>
      </div>

      <div className="mt-4">
        <Progress value={upload.progress ?? 0} />
      </div>
    </div>
  );
}
