import { apiClient } from "@/api/client";
import type { ChatQueryResponse } from "@/types";

export const chatApi = {
  query: async (question: string, documentIds?: string[]) => {
    const { data } = await apiClient.post<ChatQueryResponse>("/chat/query", {
      question,
      document_ids: documentIds && documentIds.length ? documentIds : undefined,
    });
    return data;
  },
};
