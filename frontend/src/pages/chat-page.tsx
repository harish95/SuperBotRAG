import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, MessageSquarePlus, RotateCcw, SendHorizonal, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

import { ChatMessage } from "@/components/chat-message";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { documentsApi } from "@/api/documentsApi";
import { getApiErrorMessage } from "@/api/client";
import { cn } from "@/lib/utils";
import { useChatStore } from "@/stores/chatStore";
import type { DocumentRecord } from "@/types";

export function ChatPage() {
  const messages = useChatStore((state) => state.messages);
  const loading = useChatStore((state) => state.loading);
  const draft = useChatStore((state) => state.draft);
  const setDraft = useChatStore((state) => state.setDraft);
  const sendMessage = useChatStore((state) => state.sendMessage);
  const clearChat = useChatStore((state) => state.clearChat);

  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [scopedDoc, setScopedDoc] = useState<DocumentRecord | null>(null);
  const [highlight, setHighlight] = useState(0);
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const documentsQuery = useQuery({
    queryKey: ["my-documents"],
    queryFn: documentsApi.listMine,
  });

  const processedDocs = useMemo(
    () => (documentsQuery.data || []).filter((document) => document.status === "processed"),
    [documentsQuery.data],
  );

  const showSuggestions = draft.startsWith("/") && !scopedDoc;

  const suggestions = useMemo(() => {
    if (!showSuggestions) return [];
    const term = draft.slice(1).toLowerCase();
    return processedDocs.filter((document) => document.filename.toLowerCase().includes(term));
  }, [showSuggestions, draft, processedDocs]);

  useEffect(() => {
    setHighlight(0);
  }, [draft]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const selectDocument = (document: DocumentRecord) => {
    setScopedDoc(document);
    setDraft("");
  };

  const handleSubmit = async () => {
    if (!draft.trim() || loading) {
      return;
    }

    const nextMessage = draft;
    const scope = scopedDoc;
    setDraft("");
    setError("");

    try {
      await sendMessage(nextMessage, scope ? { id: scope.id, filename: scope.filename } : undefined);
    } catch (err) {
      const message = getApiErrorMessage(err);
      setError(message);
      toast.error(message);
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showSuggestions && suggestions.length) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setHighlight((value) => (value + 1) % suggestions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setHighlight((value) => (value - 1 + suggestions.length) % suggestions.length);
        return;
      }
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        selectDocument(suggestions[highlight]);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setDraft("");
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <>
      <Card className="flex min-h-[78vh] flex-col">
        <CardHeader className="border-b border-slate-100">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle>AI Assistant</CardTitle>
              <CardDescription>Ask questions across your uploaded enterprise documents.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden rounded-2xl bg-blue-50 px-3 py-2 text-xs font-medium uppercase tracking-[0.16em] text-blue-700 sm:block">
                <span className="inline-flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  RAG ready
                </span>
              </div>
              <Button onClick={() => setConfirmOpen(true)} size="sm" variant="outline">
                <RotateCcw className="h-4 w-4" />
                Clear
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
          <div
            ref={scrollerRef}
            className="scrollbar-thin flex-1 space-y-3 overflow-y-auto rounded-3xl bg-slate-50/80 p-4"
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
                  setDraft("Summarize the most important information from my uploaded documents.")
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

          <div className="relative rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            {showSuggestions ? (
              <div className="absolute bottom-full left-4 right-4 mb-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                <p className="border-b border-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Search within a document
                </p>
                {suggestions.length ? (
                  <div className="max-h-60 overflow-y-auto py-1">
                    {suggestions.map((document, index) => (
                      <button
                        key={document.id}
                        type="button"
                        onMouseEnter={() => setHighlight(index)}
                        onClick={() => selectDocument(document)}
                        className={cn(
                          "flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition",
                          index === highlight ? "bg-blue-50 text-blue-700" : "text-slate-700",
                        )}
                      >
                        <FileText className="h-4 w-4 shrink-0 opacity-70" />
                        <span className="truncate">{document.filename}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-3 py-3 text-sm text-slate-500">
                    {processedDocs.length
                      ? "No matching documents."
                      : "No processed documents yet. Upload one first."}
                  </p>
                )}
              </div>
            ) : null}

            {scopedDoc ? (
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700">
                <FileText className="h-3.5 w-3.5" />
                <span className="max-w-[16rem] truncate">Searching only in: {scopedDoc.filename}</span>
                <button
                  type="button"
                  onClick={() => setScopedDoc(null)}
                  className="rounded-full p-0.5 transition hover:bg-blue-100"
                  aria-label="Remove document scope"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}

            <Textarea
              maxLength={2000}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                scopedDoc
                  ? `Ask a question about ${scopedDoc.filename}...`
                  : "Ask a question, or type / to search within a specific document..."
              }
              rows={3}
              value={draft}
            />
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <MessageSquarePlus className="h-4 w-4" />
                <span>Enter to send, Shift+Enter for a new line, / to scope a document</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400">{draft.length}/2000</span>
                <Button disabled={!draft.trim() || loading} onClick={() => void handleSubmit()}>
                  <SendHorizonal className="h-4 w-4" />
                  Send
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
