"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  CheckCircle2,
  FileText,
  GitBranch,
  RefreshCw,
  Server,
  MessageCircleReply,
  Bot,
  Clock3,
  ShieldAlert,
  UserRoundCheck,
  Webhook,
} from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeading } from "@/components/whatsapp/page-heading";
import { ResourceError, ResourceLoading } from "@/components/whatsapp/resource-state";
import { StatusBadge } from "@/components/whatsapp/status-badge";
import { runManagerAction } from "@/services/whatsapp-manager-client";
import type { OverviewMetrics } from "@/types/whatsapp-manager";

interface AccountSummary {
  phoneId: string;
  label: string;
  phoneNumber: string;
}

interface OverviewResponse {
  accounts: AccountSummary[];
  metrics: OverviewMetrics;
  webhookUrl: string;
  error?: string;
}

const emptyMetrics: OverviewMetrics = {
  apiStatus: "unchecked",
  webhookStatus: "inactive",
  totalAutoReply: 0,
  totalTemplates: 0,
  totalFlows: 0,
  triggersToday: 0,
  successRate: 0,
  lastWebhookAt: null,
  activeAutoReply: 0,
  queuedJobs: 0,
  failedJobsToday: 0,
  apiMessagesToday: 0,
  webhookEventsToday: 0,
  skippedToday: 0,
  activeHandovers: 0,
};

export function OverviewDashboard() {
  const [data, setData] = useState<OverviewResponse>({ accounts: [], metrics: emptyMetrics, webhookUrl: "" });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/whatsapp", { cache: "no-store" });
      const payload = await response.json() as OverviewResponse;
      if (!response.ok) throw new Error(payload.error ?? "Gagal memuat overview");
      setData(payload);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Gagal memuat overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadOverview(); }, [loadOverview]);

  const runAction = async (action: string) => {
    setRunning(action);
    try {
      if (action === "test_connection") {
        const account = data.accounts[0];
        if (!account) throw new Error("Akun Kirim.dev belum dikonfigurasi");
        const result = await runManagerAction<{ connected: boolean; error?: string }>(action, { phoneId: account.phoneId });
        setData((current) => ({
          ...current,
          metrics: { ...current.metrics, apiStatus: result.connected ? "connected" : "disconnected" },
        }));
        if (!result.connected) throw new Error(result.error ?? "Koneksi API gagal");
        toast.success("Koneksi Kirim.dev aktif");
      } else if (action === "send_test_to_admin") {
        if (!window.confirm("Kirim satu pesan WhatsApp nyata dari Bot ke Admin Utama sekarang?")) return;
        const result = await runManagerAction<{ success: boolean; message: string }>(action);
        toast.success(result.message);
        await loadOverview();
      } else {
        const result = await runManagerAction<{ success: boolean; message: string }>(action);
        toast.success(result.message);
        await loadOverview();
      }
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Aksi gagal");
    } finally {
      setRunning(null);
    }
  };

  if (loading) return <ResourceLoading />;
  if (error) return <ResourceError message={error} />;

  const metrics = [
    { label: "Total Auto Reply", value: data.metrics.totalAutoReply, icon: MessageCircleReply },
    { label: "Total Templates", value: data.metrics.totalTemplates, icon: FileText },
    { label: "Total Flow", value: data.metrics.totalFlows, icon: GitBranch },
    { label: "Trigger Hari Ini", value: data.metrics.triggersToday, icon: Activity },
    { label: "Success Rate", value: `${data.metrics.successRate}%`, icon: CheckCircle2 },
    { label: "Pesan API Hari Ini", value: data.metrics.apiMessagesToday, icon: Bot },
    { label: "Antrean Aktif", value: data.metrics.queuedJobs, icon: Clock3 },
    { label: "Gagal Hari Ini", value: data.metrics.failedJobsToday, icon: ShieldAlert },
    { label: "Handover Aktif", value: data.metrics.activeHandovers, icon: UserRoundCheck },
    { label: "Dilewati Hari Ini", value: data.metrics.skippedToday, icon: ShieldAlert },
  ];

  return (
    <div className="space-y-6">
      <PageHeading title="Overview" description="Monitoring integrasi webhook dan auto reply WhatsApp." icon={Activity} action={<Button variant="outline" onClick={loadOverview}><RefreshCw />Refresh</Button>} />

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="rounded-xl border-border/60 bg-card/80 backdrop-blur">
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Server /></div><div><p className="text-sm text-muted-foreground">API Status</p><p className="font-semibold">Kirim.dev API</p></div></div>
            <StatusBadge status={data.metrics.apiStatus} />
          </CardContent>
        </Card>
        <Card className="rounded-xl border-border/60 bg-card/80 backdrop-blur">
          <CardContent className="flex items-center justify-between p-5">
            <div className="flex items-center gap-3"><div className="rounded-xl bg-primary/10 p-3 text-primary"><Webhook /></div><div><p className="text-sm text-muted-foreground">Webhook Status</p><p className="font-semibold">{data.metrics.lastWebhookAt ? new Date(data.metrics.lastWebhookAt).toLocaleString("id-ID") : "Belum ada event"}</p></div></div>
            <StatusBadge status={data.metrics.webhookStatus} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((metric) => <Card key={metric.label} className="rounded-xl border-border/60"><CardContent className="p-5"><metric.icon className="mb-4 h-5 w-5 text-primary" /><p className="text-2xl font-bold">{metric.value}</p><p className="mt-1 text-xs text-muted-foreground">{metric.label}</p></CardContent></Card>)}
      </div>

      <Card className="rounded-xl border-border/60">
        <CardHeader><CardTitle className="text-base">Rute Pengujian Aman</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
            <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Pengirim tes</p><p className="font-semibold">{data.accounts[1]?.label ?? "Bot belum tersedia"}</p><p className="text-xs text-muted-foreground">{data.accounts[1]?.phoneNumber ?? "-"}</p></div>
            <span className="text-center text-muted-foreground">→</span>
            <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">Penerima tes</p><p className="font-semibold">{data.accounts[0]?.label ?? "Admin belum tersedia"}</p><p className="text-xs text-muted-foreground">{data.accounts[0]?.phoneNumber ?? "-"}</p></div>
          </div>
          <p className="text-xs text-muted-foreground">Sistem tidak memakai Admin sebagai pengirim dan penerima sekaligus, sehingga mematuhi batasan pengiriman ke nomor sendiri.</p>
        </CardContent>
      </Card>

      <Card className="rounded-xl border-border/60">
        <CardHeader><CardTitle className="text-base">Quick Action</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button onClick={() => runAction("test_connection")} disabled={Boolean(running)}><Server />{running === "test_connection" ? "Menguji..." : "Test API"}</Button>
          <Button variant="outline" onClick={loadOverview}><RefreshCw />Refresh</Button>
          <Button variant="outline" onClick={() => runAction("sync_templates")} disabled={Boolean(running)}><FileText />Sync Template</Button>
          <Button variant="outline" onClick={() => runAction("test_auto_reply")} disabled={Boolean(running)}><MessageCircleReply />Periksa Auto Reply</Button>
          <Button variant="outline" onClick={() => runAction("process_auto_reply_queue")} disabled={Boolean(running)}><Clock3 />Proses Antrean</Button>
          <Button variant="outline" onClick={() => runAction("send_test_to_admin")} disabled={Boolean(running) || data.accounts.length < 2}><Bot />Tes Bot → Admin</Button>
        </CardContent>
      </Card>
    </div>
  );
}
