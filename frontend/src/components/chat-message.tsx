import { useEffect, useMemo, useState } from "react";
import { Bot, Copy, User2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";

import { CitationCard } from "@/components/citation-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { ChatMessage as ChatMessageType } from "@/types";

interface ChatMessageProps {
  message: ChatMessageType;
  animate?: boolean;
}

export function ChatMessage({ message, animate = false }: ChatMessageProps) {
  const [visibleText, setVisibleText] = useState(
    message.role === "assistant" && animate ? "" : message.content,
  );

  useEffect(() => {
    if (message.role !== "assistant" || !animate) {
      setVisibleText(message.content);
      return;
    }

    let index = 0;
    const step = Math.max(2, Math.floor(message.content.length / 60));
    const timer = window.setInterval(() => {
      index = Math.min(index + step, message.content.length);
      setVisibleText(message.content.slice(0, index));
      if (index >= message.content.length) {
        window.clearInterval(timer);
      }
    }, 20);

    return () => window.clearInterval(timer);
  }, [animate, message.content, message.role]);

  const icon = useMemo(
    () =>
      message.role === "user" ? (
        <User2 className="h-4 w-4" />
      ) : (
        <Bot className="h-4 w-4" />
      ),
    [message.role],
  );

  const handleCopy = async () => {
    await navigator.clipboard.writeText(message.content);
    toast.success("Response copied");
  };

  return (
    <div
      className={cn(
        "animate-fade-in",
        message.role === "user" ? "flex justify-end" : "flex justify-start",
      )}
    >
      <div
        className={cn(
          "max-w-3xl rounded-3xl border px-5 py-4 shadow-sm",
          message.role === "user"
            ? "border-blue-100 bg-blue-600 text-white"
            : "border-slate-200 bg-white text-slate-800",
        )}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em]">
            <span
              className={cn(
                "inline-flex h-7 w-7 items-center justify-center rounded-full",
                message.role === "user" ? "bg-blue-500/60" : "bg-slate-100 text-blue-600",
              )}
            >
              {icon}
            </span>
            <span>{message.role === "user" ? "You" : "Assistant"}</span>
          </div>

          <div className="flex items-center gap-2">
            {message.cached ? <Badge variant="secondary">Cached</Badge> : null}
            {message.role === "assistant" ? (
              <Button onClick={handleCopy} size="icon" variant="ghost">
                <Copy className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        <div className={cn("markdown-body max-w-none", message.role === "user" ? "text-white" : "text-slate-700")}>
          <ReactMarkdown>{visibleText || "..."}</ReactMarkdown>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 text-xs text-slate-400">
          <span>{formatDateTime(message.createdAt)}</span>
          {message.failed ? <span className="text-rose-500">Delivery issue</span> : null}
        </div>

        {message.role === "assistant" && message.citations?.length ? (
          <div className="mt-5 space-y-3 border-t border-slate-100 pt-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Citations
            </p>
            <div className="space-y-3">
              {message.citations.map((citation, index) => (
                <CitationCard
                  key={`${citation.document}-${citation.page ?? "na"}-${index}`}
                  citation={citation}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
