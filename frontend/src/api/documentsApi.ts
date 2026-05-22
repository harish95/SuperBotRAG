import { apiClient } from "@/api/client";
import type { DocumentRecord } from "@/types";

export const documentsApi = {
  listMine: async () => {
    const { data } = await apiClient.get<DocumentRecord[]>("/documents");
    return data;
  },
  listAll: async () => {
    const { data } = await apiClient.get<DocumentRecord[]>("/admin/documents");
    return data;
  },
  remove: async (documentId: string) => {
    await apiClient.delete(`/documents/${documentId}`);
  },
};
