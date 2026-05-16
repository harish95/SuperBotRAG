import { useEffect } from "react";
import { toast } from "sonner";

import { FileDropzone } from "@/components/file-dropzone";
import { HealthStatusWidget } from "@/components/health-status-widget";
import { UploadCard } from "@/components/upload-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUploadStore } from "@/stores/uploadStore";

export function DocumentsPage() {
  const uploads = useUploadStore((state) => state.uploads);
  const uploadFile = useUploadStore((state) => state.uploadFile);
  const fetchUploads = useUploadStore((state) => state.fetchUploads);

  useEffect(() => {
    void fetchUploads();
  }, [fetchUploads]);

  const handleFilesSelected = async (files: File[]) => {
    if (!files.length) {
      toast.error("Please select supported files only.");
      return;
    }

    const results = await Promise.allSettled(files.map((file) => uploadFile(file)));
    const failed = results.filter((result) => result.status === "rejected").length;
    const success = results.filter((result) => result.status === "fulfilled").length;

    if (success) {
      toast.success(`${success} document${success > 1 ? "s" : ""} uploaded successfully.`);
    }
    if (failed) {
      toast.error(`${failed} upload${failed > 1 ? "s" : ""} failed.`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Document upload</CardTitle>
            <CardDescription>Drag and drop files to add them to the retrieval index.</CardDescription>
          </CardHeader>
          <CardContent>
            <FileDropzone onFilesSelected={(files) => void handleFilesSelected(files)} />
          </CardContent>
        </Card>

        <HealthStatusWidget />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent uploads</CardTitle>
          <CardDescription>Track document processing progress and chunk generation.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          {uploads.length ? uploads.slice(0, 6).map((upload) => <UploadCard key={upload.id} upload={upload} />) : (
            <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No uploads yet. Add a document to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
