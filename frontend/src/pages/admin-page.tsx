import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { documentsApi } from "@/api/documentsApi";
import { logsApi } from "@/api/logsApi";
import { uploadApi } from "@/api/uploadApi";
import { getApiErrorMessage } from "@/api/client";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { FileDropzone } from "@/components/file-dropzone";
import { LoadingSpinner } from "@/components/loading-spinner";
import { StatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/utils";
import type { DocumentRecord } from "@/types";

function levelVariant(level: string) {
  if (level === "ERROR") return "danger";
  if (level === "INFO") return "success";
  return "secondary";
}

export function AdminPage() {
  const queryClient = useQueryClient();
  const [logQuery, setLogQuery] = useState("");
  const [level, setLevel] = useState<"all" | "INFO" | "ERROR">("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<DocumentRecord | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["admin-documents"],
    queryFn: documentsApi.listAll,
  });

  const logsQuery = useQuery({
    queryKey: ["logs"],
    queryFn: logsApi.getLogs,
    refetchInterval: autoRefresh ? 10_000 : false,
  });

  const deleteMutation = useMutation({
    mutationFn: documentsApi.remove,
    onSuccess: () => {
      toast.success("Document deleted.");
      void queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadApi.uploadDocument(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-documents"] });
    },
    onError: (error) => toast.error(getApiErrorMessage(error)),
  });

  const handleFilesSelected = async (files: File[]) => {
    if (!files.length) {
      toast.error("Please select supported files only.");
      return;
    }
    const results = await Promise.allSettled(files.map((file) => uploadMutation.mutateAsync(file)));
    const success = results.filter((result) => result.status === "fulfilled").length;
    if (success) {
      toast.success(`${success} document${success > 1 ? "s" : ""} uploaded.`);
    }
  };

  const filteredLogs = useMemo(() => {
    return (logsQuery.data || []).filter((entry) => {
      const matchesQuery = `${entry.message} ${entry.level}`
        .toLowerCase()
        .includes(logQuery.toLowerCase());
      const matchesLevel = level === "all" ? true : entry.level === level;
      return matchesQuery && matchesLevel;
    });
  }, [level, logsQuery.data, logQuery]);

  const documents = documentsQuery.data || [];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Document management</CardTitle>
          <CardDescription>
            Upload documents for processing, review every uploaded file, and remove documents across all users.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <FileDropzone onFilesSelected={(files) => void handleFilesSelected(files)} />
          {uploadMutation.isPending ? <LoadingSpinner label="Processing upload" /> : null}

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">File name</th>
                    <th className="px-4 py-3">Owner</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Chunks</th>
                    <th className="px-4 py-3">Uploaded at</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {documentsQuery.isLoading ? (
                    <tr>
                      <td className="px-4 py-10 text-center text-slate-500" colSpan={6}>
                        Loading documents…
                      </td>
                    </tr>
                  ) : documents.length ? (
                    documents.map((document) => (
                      <tr key={document.id}>
                        <td className="px-4 py-4 font-medium text-slate-900">{document.filename}</td>
                        <td className="px-4 py-4 text-slate-600">{document.owner_email || "—"}</td>
                        <td className="px-4 py-4">
                          <StatusBadge status={document.status} />
                        </td>
                        <td className="px-4 py-4 text-slate-600">{document.chunk_count}</td>
                        <td className="px-4 py-4 text-slate-600">
                          {formatDateTime(document.upload_time)}
                        </td>
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
                      <td className="px-4 py-10 text-center text-slate-500" colSpan={6}>
                        No documents have been uploaded yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System logs</CardTitle>
          <CardDescription>Inspect recent backend activity, processing events, and chat requests.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-10"
                placeholder="Search logs"
                value={logQuery}
                onChange={(event) => setLogQuery(event.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
                <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                <span className="text-sm text-slate-600">Auto refresh</span>
              </div>

              {["all", "INFO", "ERROR"].map((item) => (
                <Button
                  key={item}
                  onClick={() => setLevel(item as typeof level)}
                  size="sm"
                  variant={level === item ? "default" : "outline"}
                >
                  {item}
                </Button>
              ))}
            </div>
          </div>

          {logsQuery.isLoading ? <LoadingSpinner label="Loading logs" /> : null}

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">Message</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredLogs.length ? (
                    filteredLogs.map((log) => (
                      <tr key={`${log.timestamp}-${log.message}`}>
                        <td className="px-4 py-4 whitespace-nowrap text-slate-600">
                          {formatDateTime(log.timestamp)}
                        </td>
                        <td className="px-4 py-4">
                          <Badge variant={levelVariant(log.level) as "success" | "danger" | "secondary"}>
                            {log.level}
                          </Badge>
                        </td>
                        <td className="px-4 py-4 text-slate-700">{log.message}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-4 py-10 text-center text-slate-500" colSpan={3}>
                        No logs match your filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </CardContent>
      </Card>

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
    </div>
  );
}
