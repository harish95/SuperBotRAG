import { useQuery } from "@tanstack/react-query";

import { healthApi } from "@/api/healthApi";
import { HealthStatusWidget } from "@/components/health-status-widget";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { useAuthStore } from "@/stores/authStore";

export function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const { data } = useQuery({
    queryKey: ["settings-health"],
    queryFn: healthApi.getHealth,
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Profile info</CardTitle>
            <CardDescription>Current authenticated user information.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Name</p>
              <p className="mt-2 font-medium text-slate-900">{user?.full_name}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Email</p>
              <p className="mt-2 font-medium text-slate-900">{user?.email}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Theme</CardTitle>
            <CardDescription>Placeholder for future theming support.</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between rounded-2xl border border-slate-200 p-4">
            <div>
              <p className="font-medium text-slate-900">Dark mode</p>
              <p className="text-sm text-slate-500">Coming in a future release.</p>
            </div>
            <Switch disabled />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System information</CardTitle>
            <CardDescription>Current backend models and API connectivity summary.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Embedding model</p>
              <p className="mt-2 font-medium text-slate-900">{data?.embedding_model || "Unknown"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Chat model</p>
              <p className="mt-2 font-medium text-slate-900">{data?.chat_model || "Unknown"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">API status</p>
              <p className="mt-2 font-medium text-slate-900">{data?.status || "Unknown"}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-slate-400">OpenAI configured</p>
              <p className="mt-2 font-medium text-slate-900">{data?.openai_configured ? "Yes" : "No"}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <HealthStatusWidget />
    </div>
  );
}
