import { create } from "zustand";
import { persist } from "zustand/middleware";

import { uploadApi } from "@/api/uploadApi";
import type { UploadEntry } from "@/types";

interface UploadState {
  uploads: UploadEntry[];
  uploadFile: (file: File) => Promise<UploadEntry>;
  fetchUploads: () => Promise<void>;
}

export const useUploadStore = create<UploadState>()(
  persist(
    (set, get) => ({
      uploads: [],
      uploadFile: async (file) => {
        const tempId = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const tempRecord: UploadEntry = {
          id: tempId,
          filename: file.name,
          status: "processing",
          uploaded_by: "current-user",
          upload_time: new Date().toISOString(),
          chunk_count: 0,
          progress: 0,
        };

        set((state) => ({
          uploads: [tempRecord, ...state.uploads.filter((item) => item.filename !== file.name)],
        }));

        try {
          const result = await uploadApi.uploadDocument(file, (progress) => {
            set((state) => ({
              uploads: state.uploads.map((item) =>
                item.id === tempId ? { ...item, progress } : item,
              ),
            }));
          });

          const finalRecord: UploadEntry = {
            ...result,
            progress: 100,
          };

          set((state) => ({
            uploads: state.uploads.map((item) => (item.id === tempId ? finalRecord : item)),
          }));

          return finalRecord;
        } catch (error) {
          set((state) => ({
            uploads: state.uploads.map((item) =>
              item.id === tempId ? { ...item, status: "failed", progress: 0 } : item,
            ),
          }));
          throw error;
        }
      },
      fetchUploads: async () => {
        const current = get().uploads;
        const refreshed = await Promise.all(
          current.map(async (upload) => {
            if (upload.id.startsWith("upload-")) {
              return upload;
            }

            try {
              const status = await uploadApi.getUploadStatus(upload.id);
              return {
                ...upload,
                ...status,
                progress: status.status === "processed" ? 100 : upload.progress ?? 0,
              };
            } catch {
              return upload;
            }
          }),
        );

        set({ uploads: refreshed });
      },
    }),
    {
      name: "upload-storage",
      partialize: (state) => ({ uploads: state.uploads }),
    },
  ),
);
