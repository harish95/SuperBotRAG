import { create } from "zustand";
import { persist } from "zustand/middleware";

import { chatApi } from "@/api/chatApi";
import { createId } from "@/lib/utils";
import type { ChatMessage } from "@/types";

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  sendMessage: (question: string) => Promise<void>;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      loading: false,
      sendMessage: async (question) => {
        const trimmed = question.trim();
        if (!trimmed) {
          return;
        }

        const userMessage: ChatMessage = {
          id: createId("user"),
          role: "user",
          content: trimmed,
          createdAt: new Date().toISOString(),
        };

        set((state) => ({
          messages: [...state.messages, userMessage],
          loading: true,
        }));

        try {
          const response = await chatApi.query(trimmed);
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
    }),
    {
      name: "chat-storage",
      partialize: (state) => ({ messages: state.messages }),
    },
  ),
);
