"use client";

import { useMemo, useState } from "react";
import { Activity, Filter, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeading } from "@/components/whatsapp/page-heading";
import { EmptyState, ResourceError, ResourceLoading } from "@/components/whatsapp/resource-state";
import { StatusBadge } from "@/components/whatsapp/status-badge";
import { useManagerResource } from "@/hooks/use-manager-resource";
import type { ActivityLog, AutomationRule } from "@/types/whatsapp-manager";

export function LogsMonitor() {
  const automations = useManagerResource<AutomationRule>("automation");
  const [customer, setCustomer] = useState("");
  const [status, setStatus] = useState("all");
  const [automationId, setAutomationId] = useState("all");
  const [eventType, setEventType] = useState("all");
  const [date, setDate] = useState("");
  const [query, setQuery] = useState("");
  const logs = useManagerResource<ActivityLog>("logs", query);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (customer.trim()) params.set("customer", customer.trim());
    if (status !== "all") params.set("status", status);
    if (automationId !== "all") params.set("automation_id", automationId);
    if (eventType !== "all") params.set("event_type", eventType);
    if (date) {
      params.set("from", new Date(`${date}T00:00:00+07:00`).toISOString());
      params.set("to", new Date(`${date}T23:59:59+07:00`).toISOString());
    }
    const nextQuery = params.toString();
    setQuery(nextQuery ? `?${nextQuery}` : "");
  };

  const sequence = useMemo(() => (log: ActivityLog) => [
    log.event_type,
    log.automation?.name ?? "Tanpa automation lama",
    log.template?.name ?? "Tanpa template",
  ].join(" → "), []);

  if (logs.loading || automations.loading) return <ResourceLoading />;
  if (logs.error || automations.error) return <ResourceError message={logs.error ?? automations.error ?? "Gagal memuat logs"} />;

  return (
    <div className="space-y-6">
      <PageHeading title="Activity & API Logs" description="Audit pengiriman API, antrean, auto reply, retry, cooldown, dan status provider." icon={Activity} action={<Button variant="outline" onClick={logs.refresh}><RefreshCw />Refresh</Button>} />
      <Card className="rounded-xl border-border/60">
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-2"><Label htmlFor="log-date">Tanggal</Label><Input id="log-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div>
          <div className="space-y-2"><Label>Automation</Label><Select value={automationId} onValueChange={setAutomationId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua</SelectItem>{automations.data.map((rule) => <SelectItem key={rule.id} value={rule.id}>{rule.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Event</Label><Select value={eventType} onValueChange={setEventType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua event</SelectItem><SelectItem value="api.message.send">API Send</SelectItem><SelectItem value="api.message.status">Status Provider</SelectItem><SelectItem value="auto_reply.queued">Auto Reply Queued</SelectItem><SelectItem value="auto_reply.sent">Auto Reply Sent</SelectItem><SelectItem value="auto_reply.failed">Auto Reply Failed</SelectItem><SelectItem value="notification.queued">Notification Queued</SelectItem><SelectItem value="notification.sent">Notification Sent</SelectItem><SelectItem value="notification.failed">Notification Failed</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua</SelectItem><SelectItem value="success">Success</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="skipped">Skipped</SelectItem></SelectContent></Select></div>
          <div className="space-y-2"><Label htmlFor="customer">Customer</Label><Input id="customer" value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Nomor / nama" /></div>
          <Button className="self-end" onClick={buildQuery}><Filter />Terapkan</Button>
        </CardContent>
      </Card>

      {logs.data.length === 0 ? <EmptyState title="Belum ada activity log" description="Semua panggilan KirimDev dan eksekusi automation akan tampil di sini." /> : (
        <Card className="overflow-hidden rounded-xl border-border/60">
          <Table><TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Customer</TableHead><TableHead>Alur</TableHead><TableHead>Status</TableHead><TableHead>Pesan</TableHead><TableHead>Detail Audit</TableHead></TableRow></TableHeader>
            <TableBody>{logs.data.map((log) => <TableRow key={log.id}><TableCell className="whitespace-nowrap">{new Date(log.created_at).toLocaleString("id-ID")}</TableCell><TableCell className="font-medium">{log.customer}</TableCell><TableCell className="min-w-72 text-muted-foreground">{sequence(log)}</TableCell><TableCell><StatusBadge status={log.status} /></TableCell><TableCell className="max-w-64 truncate">{log.message ?? "-"}</TableCell><TableCell><details className="max-w-80 text-xs"><summary className="cursor-pointer text-primary">Lihat metadata</summary><pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-muted p-2">{JSON.stringify(log.metadata, null, 2)}</pre></details></TableCell></TableRow>)}</TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
