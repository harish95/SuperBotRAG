import { apiClient } from "@/api/client";
import type { DocumentRecord, UploadStatusResponse } from "@/types";

export const uploadApi = {
  uploadDocument: async (
    file: File,
    onProgress?: (progress: number) => void,
  ) => {
    const formData = new FormData();
    formData.append("file", file);

    const { data } = await apiClient.post<DocumentRecord>("/upload/document", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (event) => {
        if (!event.total || !onProgress) return;
        onProgress(Math.round((event.loaded / event.total) * 100));
      },
    });

    return data;
  },
  getUploadStatus: async (documentId: string) => {
    const { data } = await apiClient.get<UploadStatusResponse>(`/upload/status/${documentId}`);
    return data.document;
  },
};
