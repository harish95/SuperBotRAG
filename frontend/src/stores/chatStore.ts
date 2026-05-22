import { create } from "zustand";
import { persist } from "zustand/middleware";

import { chatApi } from "@/api/chatApi";
import { createId } from "@/lib/utils";
import type { ChatMessage } from "@/types";

interface DocumentScope {
  id: string;
  filename: string;
}

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  draft: string;
  sendMessage: (question: string, scope?: DocumentScope) => Promise<void>;
  clearChat: () => void;
  setDraft: (value: string) => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      loading: false,
      draft: "",
      sendMessage: async (question, scope) => {
        const trimmed = question.trim();
        if (!trimmed) {
          return;
        }

        const userMessage: ChatMessage = {
          id: createId("user"),
          role: "user",
          content: trimmed,
          createdAt: new Date().toISOString(),
          scopedDocument: scope?.filename,
        };

        set((state) => ({
          messages: [...state.messages, userMessage],
          loading: true,
        }));

        try {
          const response = await chatApi.query(trimmed, scope ? [scope.id] : undefined);
          const assistantMessage: ChatMessage = {
            id: createId("assistant"),
            role: "assistant",
            content: response.answer,
            citations: response.citations,
            cached: response.cached,
            createdAt: new Date().toISOString(),
          };

          set((state) => ({
            messages: [...state.messages, assistantMessage],
            loading: false,
          }));
        } catch (error) {
          const failedMessage: ChatMessage = {
            id: createId("assistant"),
            role: "assistant",
            content: "I could not complete that request. Please try again.",
            createdAt: new Date().toISOString(),
            failed: true,
          };

          set((state) => ({
            messages: [...state.messages, failedMessage],
            loading: false,
          }));

          throw error;
        }
      },
      clearChat: () => {
        set({ messages: [] });
      },
      setDraft: (value) => {
        set({ draft: value });
      },
    }),
    {
      name: "chat-storage",
      partialize: (state) => ({ messages: state.messages }),
    },
  ),
);
