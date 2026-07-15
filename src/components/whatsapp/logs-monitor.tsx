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
  const [date, setDate] = useState("");
  const [query, setQuery] = useState("");
  const logs = useManagerResource<ActivityLog>("logs", query);

  const buildQuery = () => {
    const params = new URLSearchParams();
    if (customer.trim()) params.set("customer", customer.trim());
    if (status !== "all") params.set("status", status);
    if (automationId !== "all") params.set("automation_id", automationId);
    if (date) {
      params.set("from", new Date(`${date}T00:00:00+07:00`).toISOString());
      params.set("to", new Date(`${date}T23:59:59+07:00`).toISOString());
    }
    const nextQuery = params.toString();
    setQuery(nextQuery ? `?${nextQuery}` : "");
  };

  const sequence = useMemo(() => (log: ActivityLog) => [
    log.event_type,
    log.automation?.name ?? "Tanpa automation",
    log.template?.name ?? "Tanpa template",
  ].join(" → "), []);

  if (logs.loading || automations.loading) return <ResourceLoading />;
  if (logs.error || automations.error) return <ResourceError message={logs.error ?? automations.error ?? "Gagal memuat logs"} />;

  return (
    <div className="space-y-6">
      <PageHeading title="Logs" description="Histori automation dengan filter tanggal, automation, status, dan customer." icon={Activity} action={<Button variant="outline" onClick={logs.refresh}><RefreshCw />Refresh</Button>} />
      <Card className="rounded-xl border-border/60"><CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5"><div className="space-y-2"><Label htmlFor="log-date">Tanggal</Label><Input id="log-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} /></div><div className="space-y-2"><Label>Automation</Label><Select value={automationId} onValueChange={setAutomationId}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua</SelectItem>{automations.data.map((rule) => <SelectItem key={rule.id} value={rule.id}>{rule.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Status</Label><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua</SelectItem><SelectItem value="success">Success</SelectItem><SelectItem value="failed">Failed</SelectItem><SelectItem value="pending">Pending</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label htmlFor="customer">Customer</Label><Input id="customer" value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Nomor / nama" /></div><Button className="self-end" onClick={buildQuery}><Filter />Terapkan</Button></CardContent></Card>
      {logs.data.length === 0 ? <EmptyState title="Belum ada activity log" description="Log akan muncul setelah backend mengeksekusi automation." /> : <Card className="overflow-hidden rounded-xl border-border/60"><Table><TableHeader><TableRow><TableHead>Waktu</TableHead><TableHead>Customer</TableHead><TableHead>Alur</TableHead><TableHead>Status</TableHead><TableHead>Pesan</TableHead></TableRow></TableHeader><TableBody>{logs.data.map((log) => <TableRow key={log.id}><TableCell className="whitespace-nowrap">{new Date(log.created_at).toLocaleString("id-ID")}</TableCell><TableCell className="font-medium">{log.customer}</TableCell><TableCell className="min-w-72 text-muted-foreground">{sequence(log)}</TableCell><TableCell><StatusBadge status={log.status} /></TableCell><TableCell className="max-w-64 truncate">{log.message ?? "-"}</TableCell></TableRow>)}</TableBody></Table></Card>}
    </div>
  );
}

