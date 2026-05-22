import { create } from "zustand";
import { persist } from "zustand/middleware";

import { authApi } from "@/api/authApi";
import { getApiErrorMessage, persistAuthSession } from "@/api/client";
import { useChatStore } from "@/stores/chatStore";
import { useUploadStore } from "@/stores/uploadStore";
import type { User } from "@/types";

const LAST_USER_KEY = "last-user-id";

function clearUserScopedData() {
  useUploadStore.getState().reset();
  useChatStore.getState().clearChat();
}

// Clears localStorage-persisted per-user data when the active account changes,
// so one user cannot see another user's documents or chat on a shared browser.
function enforceUserScope(userId: string) {
  if (localStorage.getItem(LAST_USER_KEY) !== userId) {
    clearUserScopedData();
    localStorage.setItem(LAST_USER_KEY, userId);
  }
}

interface AuthState {
  user: User | null;
  token: string | null;
  initialized: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  initializeAuth: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      initialized: false,
      login: async (email, password) => {
        const response = await authApi.login({ email, password });
        enforceUserScope(response.user.id);
        persistAuthSession(response.access_token, JSON.stringify(response.user));
        set({
          token: response.access_token,
          user: response.user,
        });
      },
      logout: () => {
        persistAuthSession(null, null);
        clearUserScopedData();
        set({
          user: null,
          token: null,
          initialized: true,
        });
      },
      initializeAuth: async () => {
        if (get().initialized) {
          return;
        }

        const token = get().token || localStorage.getItem("auth-token");
        if (!token) {
          set({ initialized: true, user: null, token: null });
          return;
        }

        try {
          const user = await authApi.me();
          enforceUserScope(user.id);
          persistAuthSession(token, JSON.stringify(user));
          set({
            user,
            token,
            initialized: true,
          });
        } catch (error) {
          console.warn(getApiErrorMessage(error));
          persistAuthSession(null, null);
          set({
            user: null,
            token: null,
            initialized: true,
          });
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    },
  ),
);
