import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";

import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { useUploadStore } from "@/stores/uploadStore";

const PAGE_SIZE = 6;

export function UploadsPage() {
  const uploads = useUploadStore((state) => state.uploads);
  const fetchUploads = useUploadStore((state) => state.fetchUploads);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "processed" | "processing" | "failed">("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    void fetchUploads();
  }, [fetchUploads]);

  const filteredUploads = useMemo(() => {
    return uploads.filter((upload) => {
      const matchesQuery = upload.filename.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === "all" ? true : upload.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [query, status, uploads]);

  const pageCount = Math.max(1, Math.ceil(filteredUploads.length / PAGE_SIZE));
  const paginatedUploads = filteredUploads.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload history</CardTitle>
        <CardDescription>Search and filter documents uploaded from this frontend session.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-10"
              placeholder="Search by file name"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {["all", "processed", "processing", "failed"].map((item) => (
              <Button
                key={item}
                onClick={() => setStatus(item as typeof status)}
                size="sm"
                variant={status === item ? "default" : "outline"}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">File name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Uploaded at</th>
                  <th className="px-4 py-3">Chunk count</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedUploads.length ? (
                  paginatedUploads.map((upload) => (
                    <tr key={upload.id}>
                      <td className="px-4 py-4 font-medium text-slate-900">{upload.filename}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={upload.status} />
                      </td>
                      <td className="px-4 py-4 text-slate-600">{formatDateTime(upload.upload_time)}</td>
                      <td className="px-4 py-4 text-slate-600">{upload.chunk_count}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={4}>
                      No uploads match your current filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Button disabled={page === 1} onClick={() => setPage((value) => value - 1)} size="sm" variant="outline">
              Previous
            </Button>
            <Button
              disabled={page === pageCount}
              onClick={() => setPage((value) => value + 1)}
              size="sm"
              variant="outline"
            >
              Next
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
