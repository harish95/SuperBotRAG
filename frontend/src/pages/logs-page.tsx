import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";

import { logsApi } from "@/api/logsApi";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { formatDateTime } from "@/lib/utils";

function levelVariant(level: string) {
  if (level === "ERROR") return "danger";
  if (level === "INFO") return "success";
  return "secondary";
}

export function LogsPage() {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<"all" | "INFO" | "ERROR">("all");
  const [autoRefresh, setAutoRefresh] = useState(true);

  const logsQuery = useQuery({
    queryKey: ["logs"],
    queryFn: logsApi.getLogs,
    refetchInterval: autoRefresh ? 10_000 : false,
  });

  const filteredLogs = useMemo(() => {
    return (logsQuery.data || []).filter((entry) => {
      const matchesQuery = `${entry.message} ${entry.level}`.toLowerCase().includes(query.toLowerCase());
      const matchesLevel = level === "all" ? true : entry.level === level;
      return matchesQuery && matchesLevel;
    });
  }, [level, logsQuery.data, query]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Logs viewer</CardTitle>
        <CardDescription>Inspect recent backend activity, processing events, and chat requests.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="pl-10"
              placeholder="Search logs"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2">
              <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
              <span className="text-sm text-slate-600">Auto refresh</span>
            </div>

            {["all", "INFO", "ERROR"].map((item) => (
              <Button
                key={item}
                onClick={() => setLevel(item as typeof level)}
                size="sm"
                variant={level === item ? "default" : "outline"}
              >
                {item}
              </Button>
            ))}
          </div>
        </div>

        {logsQuery.isLoading ? <LoadingSpinner label="Loading logs" /> : null}

        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-400">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Level</th>
                  <th className="px-4 py-3">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredLogs.length ? (
                  filteredLogs.map((log) => (
                    <tr key={`${log.timestamp}-${log.message}`}>
                      <td className="px-4 py-4 whitespace-nowrap text-slate-600">{formatDateTime(log.timestamp)}</td>
                      <td className="px-4 py-4">
                        <Badge variant={levelVariant(log.level) as "success" | "danger" | "secondary"}>
                          {log.level}
                        </Badge>
                      </td>
                      <td className="px-4 py-4 text-slate-700">{log.message}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="px-4 py-10 text-center text-slate-500" colSpan={3}>
                      No logs match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
