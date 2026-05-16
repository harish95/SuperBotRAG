import { apiClient } from "@/api/client";
import type { HealthStatus } from "@/types";

export const healthApi = {
  getHealth: async () => {
    const { data } = await apiClient.get<HealthStatus>("/health");
    return data;
  },
};
