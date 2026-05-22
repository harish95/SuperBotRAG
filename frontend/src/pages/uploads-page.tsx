import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { documentsApi } from "@/api/documentsApi";
import { getApiErrorMessage } from "@/api/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LoadingSpinner } from "@/components/loading-spinner";
import { StatusBadge } from "@/components/status-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import type { DocumentRecord } from "@/types";

const PAGE_SIZE = 6;

export function UploadsPage() {
  const queryClient = useQueryClient();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "processed" | "processing" | "failed">("all");
  const [page, setPage] = useState(1);
  const [pendingDelete, setPendingDelete] = useState<DocumentRecord | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["my-documents"],
    queryFn: documentsApi.listMine,
  });

  const deleteMutation = useMutation({
    mutationFn: documentsApi.remove,
    onSuccess: () => {
      toast.success("Document deleted.");
      void queryClient.invalidateQueries({ queryKey: ["my-documents"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const documents = documentsQuery.data || [];

  const filteredDocuments = useMemo(() => {
    return documents.filter((document) => {
      const matchesQuery = document.filename.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = status === "all" ? true : document.status === status;
      return matchesQuery && matchesStatus;
    });
  }, [documents, query, status]);

  const pageCount = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));
  const paginatedDocuments = filteredDocuments.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    setPage(1);
  }, [query, status]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload history</CardTitle>
        <CardDescription>Review and delete documents you have uploaded to the retrieval index.</CardDescription>
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

        {documentsQuery.isLoading ? <LoadingSpinner label="Loading documents" /> : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">File name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Uploaded at</th>
                  <th className="px-4 py-3">Chunk count</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedDocuments.length ? (
                  paginatedDocuments.map((document) => (
                    <tr key={document.id}>
                      <td className="px-4 py-4 font-medium text-slate-900">{document.filename}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={document.status} />
                      </td>
                      <td className="px-4 py-4 text-slate-600">{formatDateTime(document.upload_time)}</td>
                      <td className="px-4 py-4 text-slate-600">{document.chunk_count}</td>
                      <td className="px-4 py-4 text-right">
                        <Button
                          size="sm"
                          variant="danger"
                          disabled={deleteMutation.isPending}
                          onClick={() => setPendingDelete(document)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={5}>
                      No documents match your current filters.
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

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Delete document"
        description={`Permanently delete "${pendingDelete?.filename}" and its indexed chunks? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          if (pendingDelete) {
            deleteMutation.mutate(pendingDelete.id);
          }
        }}
      />
    </Card>
  );
}
