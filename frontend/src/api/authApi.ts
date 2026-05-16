import { apiClient } from "@/api/client";
import type { TokenResponse, User } from "@/types";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  full_name: string;
  email: string;
  password: string;
}

export const authApi = {
  register: async (payload: RegisterPayload) => {
    const { data } = await apiClient.post<User>("/auth/register", payload);
    return data;
  },
  login: async (payload: LoginPayload) => {
    const { data } = await apiClient.post<TokenResponse>("/auth/login", payload);
    return data;
  },
  me: async () => {
    const { data } = await apiClient.get<User>("/auth/me");
    return data;
  },
};
