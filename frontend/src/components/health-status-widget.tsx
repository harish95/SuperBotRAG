import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ServerCrash } from "lucide-react";

import { healthApi } from "@/api/healthApi";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingSpinner } from "@/components/loading-spinner";

export function HealthStatusWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["health"],
    queryFn: healthApi.getHealth,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Health</CardTitle>
        <CardDescription>Live backend connectivity and model status.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <LoadingSpinner label="Checking backend" />
        ) : data ? (
          <div className="space-y-4 text-sm">
            <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
              <div>
                <p className="font-medium text-slate-900">Backend status</p>
                <p className="text-slate-500">{data.status}</p>
              </div>
              {data.status === "ok" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              ) : (
                <ServerCrash className="h-5 w-5 text-rose-600" />
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Embeddings</p>
                <p className="mt-2 font-medium text-slate-900">{data.embedding_model}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Chat model</p>
                <p className="mt-2 font-medium text-slate-900">{data.chat_model}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">OpenAI</p>
              <p className="mt-2 font-medium text-slate-900">
                {data.openai_configured ? "Configured" : "Missing API key"}
              </p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
