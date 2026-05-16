import { useEffect, useMemo, useRef, useState } from "react";
import { MessageSquarePlus, RotateCcw, SendHorizonal, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { ChatMessage } from "@/components/chat-message";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/api/client";
import { formatRelativeTime } from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";

export function ChatPage() {
  const messages = useChatStore((state) => state.messages);
  const loading = useChatStore((state) => state.loading);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const clearChat = useChatStore((state) => state.clearChat);

  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const recentPrompts = useMemo(
    () =>
      messages
        .filter((message) => message.role === "user")
        .slice(-6)
        .reverse(),
    [messages],
  );

  const handleSubmit = async () => {
    if (!input.trim() || loading) {
      return;
    }

    const nextMessage = input;
    setInput("");
    setError("");

    try {
      await sendMessage(nextMessage);
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      toast.error(message);
    }
  };

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Conversation history</CardTitle>
            <CardDescription>Recent prompts in this workspace session.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentPrompts.length ? (
              recentPrompts.map((prompt) => (
                <button
                  key={prompt.id}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-200 hover:bg-blue-50"
                  onClick={() => setInput(prompt.content)}
                  type="button"
                >
                  <p className="line-clamp-2 text-sm font-medium text-slate-900">{prompt.content}</p>
                  <p className="mt-2 text-xs text-slate-500">{formatRelativeTime(prompt.createdAt)}</p>
                </button>
              ))
            ) : (
              <EmptyState
                title="No chat history yet"
                description="Start a conversation and your recent prompts will appear here for quick reuse."
              />
            )}

            <Button className="w-full" onClick={() => setConfirmOpen(true)} variant="outline">
              <RotateCcw className="h-4 w-4" />
              Clear chat
            </Button>
          </CardContent>
        </Card>

        <Card className="flex min-h-[75vh] flex-col">
          <CardHeader className="border-b border-slate-100">
            <div className="flex items-center justify-between gap-3">
              <div>
                <CardTitle>AI Assistant</CardTitle>
                <CardDescription>Ask questions across your uploaded enterprise documents.</CardDescription>
              </div>
              <div className="rounded-2xl bg-blue-50 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-blue-700">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  RAG ready
                </span>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
            <div
              ref={scrollerRef}
              className="scrollbar-thin flex-1 space-y-4 overflow-y-auto rounded-3xl bg-slate-50/80 p-4"
            >
              {messages.length ? (
                messages.map((message, index) => (
                  <ChatMessage
                    key={message.id}
                    animate={index === messages.length - 1 && message.role === "assistant"}
                    message={message}
                  />
                ))
              ) : (
                <EmptyState
                  title="Start your first question"
                  description="Upload a few documents, then ask about policies, contracts, procedures, or anything stored in your knowledge base."
                  actionLabel="Try a sample prompt"
                  onAction={() =>
                    setInput("Summarize the most important information from my uploaded documents.")
                  }
                />
              )}

              {loading ? (
                <div className="flex justify-start">
                  <div className="rounded-3xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
                    <LoadingSpinner label="Assistant is thinking" />
                  </div>
                </div>
              ) : null}
            </div>

            {error ? <ErrorState description={error} onRetry={handleSubmit} /> : null}

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <Textarea
                maxLength={2000}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void handleSubmit();
                  }
                }}
                placeholder="Ask a question about uploaded documents..."
                rows={5}
                value={input}
              />
              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <MessageSquarePlus className="h-4 w-4" />
                  <span>Enter to send, Shift+Enter for a new line</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{input.length}/2000</span>
                  <Button disabled={!input.trim() || loading} onClick={() => void handleSubmit()}>
                    <SendHorizonal className="h-4 w-4" />
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        confirmLabel="Clear chat"
        description="This will remove the current conversation from the local session history."
        onConfirm={clearChat}
        onOpenChange={setConfirmOpen}
        open={confirmOpen}
        title="Clear conversation?"
      />
    </>
  );
}
