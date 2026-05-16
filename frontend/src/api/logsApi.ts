import { apiClient } from "@/api/client";
import type { LogEntry } from "@/types";

export const logsApi = {
  getLogs: async () => {
    const { data } = await apiClient.get<LogEntry[]>("/logs");
    return data;
  },
};
