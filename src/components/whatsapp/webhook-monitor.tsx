"use client";

import { useMemo } from "react";
import { ArrowDownLeft, ArrowUpRight, Clock3, RefreshCw, Webhook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeading } from "@/components/whatsapp/page-heading";
import { EmptyState, ResourceError, ResourceLoading } from "@/components/whatsapp/resource-state";
import { StatusBadge } from "@/components/whatsapp/status-badge";
import { useManagerResource } from "@/hooks/use-manager-resource";
import type { WebhookLog } from "@/types/whatsapp-manager";

export function WebhookMonitor() {
  const logs = useManagerResource<WebhookLog>("webhook_logs");
  const metrics = useMemo(() => {
    const average = logs.data.length ? Math.round(logs.data.reduce((sum, item) => sum + item.latency_ms, 0) / logs.data.length) : 0;
    return {
      incoming: logs.data.filter((item) => item.direction === "incoming").length,
      outgoing: logs.data.filter((item) => item.direction === "outgoing").length,
      retry: logs.data.reduce((sum, item) => sum + item.retry_count, 0),
      average,
    };
  }, [logs.data]);
  if (logs.loading) return <ResourceLoading />;
  if (logs.error) return <ResourceError message={logs.error} />;
  const cards = [
    { label: "Incoming", value: metrics.incoming, icon: ArrowDownLeft },
    { label: "Outgoing", value: metrics.outgoing, icon: ArrowUpRight },
    { label: "Retry", value: metrics.retry, icon: RefreshCw },
    { label: "Avg. Latency", value: `${metrics.average} ms`, icon: Clock3 },
  ];
  return (
    <div className="space-y-6">
      <PageHeading title="Webhook" description="Monitoring event webhook secara read-only untuk debugging operasional." icon={Webhook} action={<Button variant="outline" onClick={logs.refresh}><RefreshCw />Refresh</Button>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{cards.map((item) => <Card key={item.label} className="rounded-xl border-border/60"><CardContent className="p-5"><item.icon className="mb-3 h-5 w-5 text-primary" /><p className="text-2xl font-bold">{item.value}</p><p className="text-xs text-muted-foreground">{item.label}</p></CardContent></Card>)}</div>
      {logs.data.length === 0 ? <EmptyState title="Belum ada webhook log" description="Event incoming, outgoing, API accepted/failed, delivered, read, dan retry akan tampil di sini." /> : <Card className="overflow-hidden rounded-xl border-border/60"><Table><TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Arah</TableHead><TableHead>Event</TableHead><TableHead>Status</TableHead><TableHead>Latency</TableHead><TableHead>Retry</TableHead><TableHead>Payload</TableHead></TableRow></TableHeader><TableBody>{logs.data.map((log) => <TableRow key={log.id}><TableCell className="whitespace-nowrap">{new Date(log.created_at).toLocaleString("id-ID")}</TableCell><TableCell className="capitalize">{log.direction}</TableCell><TableCell className="font-medium">{log.event_type}</TableCell><TableCell><StatusBadge status={log.status} /></TableCell><TableCell>{log.latency_ms} ms</TableCell><TableCell>{log.retry_count}</TableCell><TableCell><details className="max-w-80 text-xs"><summary className="cursor-pointer text-primary">Lihat payload</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2">{JSON.stringify(log.payload, null, 2)}</pre></details></TableCell></TableRow>)}</TableBody></Table></Card>}
    </div>
  );
}
