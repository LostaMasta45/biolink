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
  id: string;
  event_key: string;
  recipient: string;
  status: string;
  attempts: number;
  last_error: string | null;
  scheduled_at: string;
  created_at: string;
}

const EVENT_VARIABLES: Record<string, string[]> = {
  "payment.paid.customer": ["customer_name", "company_name", "package_name", "amount", "order_id", "invoice_url"],
  "payment.paid.admin": ["customer_name", "company_name", "package_name", "amount", "order_id"],
  "invoice.created.admin": ["invoice_number", "customer_name", "customer_phone", "amount", "invoice_url"],
  "invoice.created.customer": ["customer_name", "package_name", "amount", "order_id", "payment_url"],
  "invoice.reminder.customer": ["customer_name", "package_name", "amount", "order_id", "payment_url"],
  "poster.received.customer": ["customer_name", "company_name", "package_name", "order_id", "poster_count", "scheduled_date"],
  "poster.received.admin": ["customer_name", "company_name", "package_name", "order_id", "poster_count", "scheduled_date"],
};

type FormState = Omit<NotificationRule, "id" | "created_at" | "updated_at" | "template"> & { defaultsText: string };

const blank: FormState = {
  event_key: "",
  name: "",
  description: "",
  recipient_type: "customer",
  custom_recipient: "",
  sender_role: "admin",
  template_id: null,
  is_active: true,
  delay_seconds: 2,
  max_attempts: 3,
  dedupe_window_seconds: 300,
  variable_defaults: {},
  defaultsText: "{}",
};

function senderForRecipient(recipientType: NotificationRule["recipient_type"]): NotificationRule["sender_role"] {
  return recipientType === "admin" ? "bot" : "admin";
}

function recipientLabel(recipientType: NotificationRule["recipient_type"]) {
  if (recipientType === "admin") return "Admin Utama";
  if (recipientType === "bot") return "Bot";
  if (recipientType === "customer") return "Customer";
  return "Nomor custom";
}

export function NotificationCenterManager() {
  const rules = useManagerResource<NotificationRule>("notification_rules");
  const templates = useManagerResource<WhatsAppTemplate>("templates");
  const jobs = useManagerResource<NotificationJob>("notification_jobs");
  const [editing, setEditing] = useState<NotificationRule | null>(null);
  const [form, setForm] = useState<FormState>(blank);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [testingCustomerRule, setTestingCustomerRule] = useState<NotificationRule | null>(null);
  const [testCustomerPhone, setTestCustomerPhone] = useState("");

  const stats = useMemo(() => ({
    queued: jobs.data.filter((job) => ["queued", "retry", "processing"].includes(job.status)).length,
    failed: jobs.data.filter((job) => job.status === "failed").length,
    sent: jobs.data.filter((job) => job.status === "sent").length,
  }), [jobs.data]);

  const openForm = (rule?: NotificationRule) => {
    setEditing(rule ?? null);
    setForm(rule
      ? { ...rule, description: rule.description ?? "", custom_recipient: rule.custom_recipient ?? "", defaultsText: JSON.stringify(rule.variable_defaults ?? {}, null, 2) }
      : blank);
    setOpen(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      const variable_defaults = JSON.parse(form.defaultsText || "{}") as Record<string, string>;
      const payload = {
        ...form,
        variable_defaults,
        sender_role: senderForRecipient(form.recipient_type),
      } as Record<string, unknown>;
      delete payload.defaultsText;
      if (editing) await updateManagerResource("notification_rules", editing.id, payload);
      else await createManagerResource("notification_rules", payload);
      toast.success("Rule notifikasi tersimpan");
      setOpen(false);
      await rules.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan rule");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async (rule: NotificationRule, customerPhone?: string) => {
    const sender = senderForRecipient(rule.recipient_type) === "bot" ? "Bot" : "Admin Utama";
    const destination = recipientLabel(rule.recipient_type);
    if (!window.confirm(`Kirim tes nyata ${sender} → ${destination}?`)) return;
    setRunning(rule.id);
    try {
      await runManagerAction("test_notification_rule", customerPhone ? { ruleId: rule.id, customerPhone } : { ruleId: rule.id });
      toast.success(`Tes dikirim ${sender} → ${destination}`);
      await jobs.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Tes gagal");
    } finally {
      setRunning(null);
      setTestingCustomerRule(null);
      setTestCustomerPhone("");
    }
  };

  const testRule = (rule: NotificationRule) => {
    if (rule.recipient_type === "customer") {
      setTestingCustomerRule(rule);
      setTestCustomerPhone("");
      return;
    }
    void sendTest(rule);
  };

  if (rules.loading || templates.loading || jobs.loading) return <ResourceLoading />;
  if (rules.error || templates.error || jobs.error) return <ResourceError message={rules.error ?? templates.error ?? jobs.error ?? "Gagal memuat Notification Center. Jalankan migration Notification Center terlebih dahulu."} />;
  const variables = EVENT_VARIABLES[form.event_key] ?? [];

  return <div className="space-y-6">
    <PageHeading title="Notification Center" description="Atur copywriting, pengirim, penerima, delay, retry, dan deduplikasi notifikasi sistem." icon={BellRing} action={<Button onClick={() => openForm()}><Plus />Rule Baru</Button>} />
    <Card className="border-primary/20 bg-primary/5"><CardContent className="p-4 text-sm"><p className="font-medium">Rute pengiriman</p><p className="mt-1 text-muted-foreground">Bot → Admin Utama untuk notifikasi internal; Admin Utama → Bot, customer, atau nomor custom. Semua pesan free-form hanya dikirim saat penerima masih berada dalam jendela WhatsApp 24 jam; jika tidak, alasan lengkap tersimpan di Logs.</p></CardContent></Card>
    <div className="grid gap-3 sm:grid-cols-3">{[["Antrean", stats.queued], ["Terkirim (250 log)", stats.sent], ["Gagal (250 log)", stats.failed]].map(([label, value]) => <Card key={String(label)}><CardContent className="p-5"><p className="text-2xl font-bold">{value}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>)}</div>

    {rules.data.length === 0 ? <EmptyState title="Belum ada rule notifikasi" description="Buat rule atau jalankan migration seed Notification Center." /> : <div className="grid gap-4 lg:grid-cols-2">{rules.data.map((rule) => <Card key={rule.id} className="rounded-xl border-border/60"><CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle className="text-base">{rule.name}</CardTitle><p className="mt-1 font-mono text-xs text-muted-foreground">{rule.event_key}</p></div><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => testRule(rule)} disabled={running === rule.id} title="Kirim tes sesuai rute rule"><Play /></Button><Button size="icon" variant="ghost" onClick={() => openForm(rule)}><Pencil /></Button></div></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-2"><StatusBadge status={rule.is_active ? "active" : "inactive"} label={rule.is_active ? "Aktif" : "Nonaktif"} /><Badge variant="outline">{rule.sender_role === "bot" ? "Bot" : "Admin Utama"} → {recipientLabel(rule.recipient_type)}</Badge></div><div className="rounded-xl border bg-muted/30 p-3 text-sm"><p className="font-medium">{rule.template?.name ?? "Pesan belum dipilih"}</p><p className="mt-1 text-xs text-muted-foreground">Delay {rule.delay_seconds} dtk · retry {rule.max_attempts}× · dedupe {rule.dedupe_window_seconds} dtk</p></div></CardContent></Card>)}</div>}

    <Card><CardHeader className="flex-row items-center justify-between"><CardTitle className="text-base">Pengiriman Terbaru</CardTitle><div className="flex gap-2"><Button size="sm" variant="outline" onClick={async () => { await runManagerAction("process_notification_queue"); await jobs.refresh(); }}><Clock3 />Proses Antrean</Button><Button size="icon" variant="ghost" onClick={jobs.refresh}><RefreshCw /></Button></div></CardHeader><CardContent className="space-y-2">{jobs.data.slice(0, 20).map((job) => <div key={job.id} className="flex flex-col justify-between gap-2 rounded-xl border p-3 sm:flex-row sm:items-center"><div><p className="text-sm font-medium">{job.event_key}</p><p className="text-xs text-muted-foreground">{job.recipient} · {new Date(job.created_at).toLocaleString("id-ID")}</p>{job.last_error && <p className="mt-1 text-xs text-destructive">{job.last_error}</p>}</div><Badge variant={job.status === "failed" ? "destructive" : "outline"}>{job.status}</Badge></div>)}</CardContent></Card>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Edit Rule Notifikasi" : "Rule Notifikasi Baru"}</DialogTitle><DialogDescription>Notifikasi customer memakai pesan free-form dari Admin Utama dan hanya bisa terkirim dalam jendela 24 jam setelah customer chat.</DialogDescription></DialogHeader><div className="space-y-4">
      <Field label="Nama"><Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field>
      <Field label="Event key"><Input value={form.event_key} disabled={Boolean(editing)} placeholder="payment.paid.customer" onChange={(event) => setForm({ ...form, event_key: event.target.value.toLowerCase() })} /></Field>
      <Field label="Deskripsi"><Textarea value={form.description ?? ""} onChange={(event) => setForm({ ...form, description: event.target.value })} /></Field>
      <div className="grid gap-4 sm:grid-cols-2"><Field label="Penerima"><Select value={form.recipient_type} onValueChange={(value) => { const recipient_type = value as FormState["recipient_type"]; setForm({ ...form, recipient_type, sender_role: senderForRecipient(recipient_type) }); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="customer">Customer dari event</SelectItem><SelectItem value="admin">Admin Utama</SelectItem><SelectItem value="bot">Bot</SelectItem><SelectItem value="custom">Nomor custom</SelectItem></SelectContent></Select></Field><Field label="Pengirim"><Select value={senderForRecipient(form.recipient_type)} disabled><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="admin">Admin Utama</SelectItem><SelectItem value="bot">Bot</SelectItem></SelectContent></Select></Field></div>
      {form.recipient_type === "custom" && <Field label="Nomor custom"><Input value={form.custom_recipient ?? ""} placeholder="628…" inputMode="numeric" onChange={(event) => setForm({ ...form, custom_recipient: event.target.value })} /></Field>}
      <Field label="Pesan Tersimpan"><Select value={form.template_id ?? "none"} onValueChange={(value) => setForm({ ...form, template_id: value === "none" ? null : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Belum dipilih</SelectItem>{templates.data.filter((template) => template.is_active).map((template) => <SelectItem key={template.id} value={template.id}>{template.name} · {template.type}</SelectItem>)}</SelectContent></Select></Field>
      {variables.length > 0 && <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs font-medium">Variabel event</p><div className="mt-2 flex flex-wrap gap-2">{variables.map((variable) => <Badge key={variable} variant="secondary">{`{{${variable}}}`}</Badge>)}</div></div>}
      <div className="grid gap-4 sm:grid-cols-3"><Field label="Delay (detik)"><Input type="number" value={form.delay_seconds} onChange={(event) => setForm({ ...form, delay_seconds: Number(event.target.value) })} /></Field><Field label="Maks. retry"><Input type="number" value={form.max_attempts} onChange={(event) => setForm({ ...form, max_attempts: Number(event.target.value) })} /></Field><Field label="Dedupe (detik)"><Input type="number" value={form.dedupe_window_seconds} onChange={(event) => setForm({ ...form, dedupe_window_seconds: Number(event.target.value) })} /></Field></div>
      <Field label="Default variabel (JSON)"><Textarea className="font-mono text-xs" rows={4} value={form.defaultsText} onChange={(event) => setForm({ ...form, defaultsText: event.target.value })} /></Field>
      <div className="flex items-center justify-between rounded-xl border p-4"><div><Label>Rule aktif</Label><p className="text-xs text-muted-foreground">Rule nonaktif tidak mengirim pesan.</p></div><Switch checked={form.is_active} onCheckedChange={(checked) => setForm({ ...form, is_active: checked })} /></div>
    </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button onClick={save} disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={Boolean(testingCustomerRule)} onOpenChange={(isOpen) => { if (!isOpen) { setTestingCustomerRule(null); setTestCustomerPhone(""); } }}><DialogContent><DialogHeader><DialogTitle>Tes notifikasi ke customer</DialogTitle><DialogDescription>Pesan akan dikirim nyata dari Admin Utama. Pastikan customer ini telah mengirim chat dalam 24 jam terakhir; KirimDev menolak pesan free-form di luar jendela tersebut.</DialogDescription></DialogHeader><Field label="Nomor customer"><Input value={testCustomerPhone} placeholder="628…" inputMode="numeric" onChange={(event) => setTestCustomerPhone(event.target.value)} /></Field><DialogFooter><Button variant="outline" onClick={() => setTestingCustomerRule(null)}>Batal</Button><Button onClick={() => testingCustomerRule && void sendTest(testingCustomerRule, testCustomerPhone)} disabled={!testCustomerPhone.trim() || running === testingCustomerRule?.id}>Kirim tes</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}
