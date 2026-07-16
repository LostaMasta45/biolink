"use client";

import { useMemo, useState } from "react";
import { BellRing, Clock3, Pencil, Play, Plus, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeading } from "@/components/whatsapp/page-heading";
import { EmptyState, ResourceError, ResourceLoading } from "@/components/whatsapp/resource-state";
import { StatusBadge } from "@/components/whatsapp/status-badge";
import { useManagerResource } from "@/hooks/use-manager-resource";
import { createManagerResource, runManagerAction, updateManagerResource } from "@/services/whatsapp-manager-client";
import type { NotificationRule, WhatsAppTemplate } from "@/types/whatsapp-manager";

interface NotificationJob {
  id: string; event_key: string; recipient: string; status: string; attempts: number; last_error: string | null; scheduled_at: string; created_at: string;
}

const EVENT_VARIABLES: Record<string, string[]> = {
  "payment.paid.customer": ["customer_name", "company_name", "package_name", "amount", "order_id"],
  "payment.paid.admin": ["customer_name", "company_name", "package_name", "amount", "order_id"],
  "invoice.created.admin": ["invoice_number", "customer_name", "customer_phone", "amount", "invoice_url"],
  "invoice.created.customer": ["customer_name", "package_name", "amount", "order_id", "payment_url"],
  "invoice.reminder.customer": ["customer_name", "package_name", "amount", "order_id", "payment_url"],
  "poster.received.customer": ["customer_name", "company_name", "package_name", "order_id", "poster_count", "scheduled_date"],
};

type FormState = Omit<NotificationRule, "id" | "created_at" | "updated_at" | "template"> & { defaultsText: string };
const blank: FormState = { event_key: "", name: "", description: "", recipient_type: "customer", custom_recipient: "", sender_role: "admin", template_id: null, is_active: true, delay_seconds: 2, max_attempts: 3, dedupe_window_seconds: 300, variable_defaults: {}, defaultsText: "{}" };

export function NotificationCenterManager() {
  const rules = useManagerResource<NotificationRule>("notification_rules");
  const templates = useManagerResource<WhatsAppTemplate>("templates");
  const jobs = useManagerResource<NotificationJob>("notification_jobs");
  const [editing, setEditing] = useState<NotificationRule | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);

  const stats = useMemo(() => ({ queued: jobs.data.filter((j) => ["queued", "retry", "processing"].includes(j.status)).length, failed: jobs.data.filter((j) => j.status === "failed").length, sent: jobs.data.filter((j) => j.status === "sent").length }), [jobs.data]);

  const openForm = (rule?: NotificationRule) => {
    setEditing(rule ?? null);
    setForm(rule ? { ...rule, description: rule.description ?? "", custom_recipient: rule.custom_recipient ?? "", defaultsText: JSON.stringify(rule.variable_defaults ?? {}, null, 2) } : blank);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const variable_defaults = JSON.parse(form.defaultsText || "{}") as Record<string, string>;
      const payload = { ...form, variable_defaults } as Record<string, unknown>;
      delete payload.defaultsText;
      if (payload.recipient_type === "admin") payload.sender_role = "bot";
      if (editing) await updateManagerResource("notification_rules", editing.id, payload);
      else await createManagerResource("notification_rules", payload);
      toast.success("Rule notifikasi tersimpan"); setOpen(false); await rules.refresh();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menyimpan rule"); }
    finally { setSaving(false); }
  };

  const testRule = async (id: string) => {
    if (!window.confirm("Kirim tes nyata dari Bot ke Admin Utama?")) return;
    setRunning(id);
    try { await runManagerAction("test_notification_rule", { ruleId: id }); toast.success("Tes dikirim Bot → Admin Utama"); await jobs.refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Tes gagal"); }
    finally { setRunning(null); }
  };

  if (rules.loading || templates.loading || jobs.loading) return <ResourceLoading />;
  if (rules.error || templates.error || jobs.error) return <ResourceError message={rules.error ?? templates.error ?? jobs.error ?? "Gagal memuat Notification Center. Jalankan migration Notification Center terlebih dahulu."} />;
  const variables = EVENT_VARIABLES[form.event_key] ?? [];

  return <div className="space-y-6">
    <PageHeading title="Notification Center" description="Atur copywriting, pengirim, penerima, delay, retry, dan deduplikasi notifikasi sistem." icon={BellRing} action={<Button onClick={() => openForm()}><Plus />Rule Baru</Button>} />
    <div className="grid gap-3 sm:grid-cols-3">{[["Antrean", stats.queued], ["Terkirim (250 log)", stats.sent], ["Gagal (250 log)", stats.failed]].map(([label, value]) => <Card key={String(label)}><CardContent className="p-5"><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>)}</div>

    {rules.data.length === 0 ? <EmptyState title="Belum ada rule notifikasi" description="Buat rule atau jalankan migration seed Notification Center." /> : <div className="grid gap-4 lg:grid-cols-2">{rules.data.map((rule) => <Card key={rule.id} className="rounded-xl border-border/60"><CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle className="text-base">{rule.name}</CardTitle><p className="mt-1 font-mono text-xs text-muted-foreground">{rule.event_key}</p></div><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => testRule(rule.id)} disabled={running === rule.id}><Play /></Button><Button size="icon" variant="ghost" onClick={() => openForm(rule)}><Pencil /></Button></div></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-2"><StatusBadge status={rule.is_active ? "active" : "inactive"} label={rule.is_active ? "Aktif" : "Nonaktif"} /><Badge variant="outline">{rule.sender_role === "bot" ? "Bot" : "Admin Utama"} → {rule.recipient_type === "admin" ? "Admin Utama" : rule.recipient_type === "customer" ? "Customer" : "Nomor custom"}</Badge></div><div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="font-medium">{rule.template?.name ?? "Pesan belum dipilih"}</p><p className="mt-1 text-xs text-muted-foreground">Delay {rule.delay_seconds} dtk · retry {rule.max_attempts}× · dedupe {rule.dedupe_window_seconds} dtk</p></div></CardContent></Card>)}</div>}

    <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Pengiriman Terbaru</CardTitle><div className="flex gap-2"><Button size="sm" variant="outline" onClick={async () => { await runManagerAction("process_notification_queue"); await jobs.refresh(); }}><Clock3 />Proses Antrean</Button><Button size="icon" variant="ghost" onClick={jobs.refresh}><RefreshCw /></Button></div></CardHeader><CardContent className="space-y-2">{jobs.data.slice(0, 20).map((job) => <div key={job.id} className="flex flex-col justify-between gap-2 rounded-xl border p-3 sm:flex-row sm:items-center"><div><p className="text-sm font-medium">{job.event_key}</p><p className="text-xs text-muted-foreground">{job.recipient} · {new Date(job.created_at).toLocaleString("id-ID")}</p>{job.last_error && <p className="mt-1 text-xs text-destructive">{job.last_error}</p>}</div><Badge variant={job.status === "failed" ? "destructive" : "outline"}>{job.status}</Badge></div>)}</CardContent></Card>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Edit Rule Notifikasi" : "Rule Notifikasi Baru"}</DialogTitle><DialogDescription>Notifikasi customer menggunakan pesan free-form karena customer memulai chat ke Admin Utama.</DialogDescription></DialogHeader><div className="space-y-4">
      <Field label="Nama"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Event key"><Input value={form.event_key} disabled={Boolean(editing)} placeholder="payment.paid.customer" onChange={(e) => setForm({ ...form, event_key: e.target.value.toLowerCase() })} /></Field>
      <Field label="Deskripsi"><Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Penerima"><Select value={form.recipient_type} onValueChange={(value) => setForm({ ...form, recipient_type: value as FormState["recipient_type"], sender_role: value === "admin" ? "bot" : form.sender_role })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="customer">Customer dari event</SelectItem><SelectItem value="admin">Admin Utama</SelectItem><SelectItem value="custom">Nomor custom</SelectItem></SelectContent></Select></Field><Field label="Pengirim"><Select value={form.sender_role} disabled={form.recipient_type === "admin"} onValueChange={(value) => setForm({ ...form, sender_role: value as FormState["sender_role"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Admin Utama</SelectItem><SelectItem value="bot">Bot</SelectItem></SelectContent></Select></Field></div>
      {form.recipient_type === "custom" && <Field label="Nomor custom"><Input value={form.custom_recipient ?? ""} placeholder="628…" onChange={(e) => setForm({ ...form, custom_recipient: e.target.value })} /></Field>}
      <Field label="Pesan Tersimpan"><Select value={form.template_id ?? "none"} onValueChange={(value) => setForm({ ...form, template_id: value === "none" ? null : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Belum dipilih</SelectItem>{templates.data.filter((t) => t.is_active).map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {t.type}</SelectItem>)}</SelectContent></Select></Field>
      {variables.length > 0 && <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs font-medium">Variabel event</p><div className="mt-2 flex flex-wrap gap-2">{variables.map((v) => <Badge key={v} variant="secondary">{`{{${v}}}`}</Badge>)}</div></div>}
      <div className="grid gap-4 sm:grid-cols-3"><Field label="Delay (detik)"><Input type="number" value={form.delay_seconds} onChange={(e) => setForm({ ...form, delay_seconds: Number(e.target.value) })} /></Field><Field label="Maks. retry"><Input type="number" value={form.max_attempts} onChange={(e) => setForm({ ...form, max_attempts: Number(e.target.value) })} /></Field><Field label="Dedupe (detik)"><Input type="number" value={form.dedupe_window_seconds} onChange={(e) => setForm({ ...form, dedupe_window_seconds: Number(e.target.value) })} /></Field></div>
      <Field label="Default variabel (JSON)"><Textarea className="font-mono text-xs" rows={4} value={form.defaultsText} onChange={(e) => setForm({ ...form, defaultsText: e.target.value })} /></Field>
      <div className="flex items-center justify-between rounded-xl border p-4"><div><Label>Rule aktif</Label><p className="text-xs text-muted-foreground">Rule nonaktif tidak mengirim pesan.</p></div><Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} /></div>
    </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
