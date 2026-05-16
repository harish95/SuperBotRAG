import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
}

export function ErrorState({
  title = "Something went wrong",
  description,
  onRetry,
}: ErrorStateProps) {
  return (
    <div className="rounded-2xl border border-rose-100 bg-rose-50 p-5 text-sm text-rose-700">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="space-y-3">
          <div>
            <p className="font-semibold">{title}</p>
            <p className="mt-1 text-rose-600">{description}</p>
          </div>
          {onRetry ? (
            <Button onClick={onRetry} size="sm" variant="outline">
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
