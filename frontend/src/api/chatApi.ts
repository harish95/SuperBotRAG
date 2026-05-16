import { apiClient } from "@/api/client";
import type { ChatQueryResponse } from "@/types";

export const chatApi = {
  query: async (question: string) => {
    const { data } = await apiClient.post<ChatQueryResponse>("/chat/query", { question });
    return data;
  },
};
