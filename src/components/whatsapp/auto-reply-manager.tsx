"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { ArrowRight, MessageCircleReply, Pencil, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DeleteConfirmation } from "@/components/whatsapp/delete-confirmation";
import { PageHeading } from "@/components/whatsapp/page-heading";
import { EmptyState, ResourceError, ResourceLoading } from "@/components/whatsapp/resource-state";
import { StatusBadge } from "@/components/whatsapp/status-badge";
import { useManagerResource } from "@/hooks/use-manager-resource";
import { createManagerResource, deleteManagerResource, updateManagerResource } from "@/services/whatsapp-manager-client";
import type { AutoReplyRule, CustomerFlow, WhatsAppTemplate } from "@/types/whatsapp-manager";
import { autoReplySchema, type AutoReplyFormValues } from "@/validation/whatsapp-manager";

const defaults: AutoReplyFormValues = { keyword: "", phone_id: null, template_id: "", flow_id: null, is_active: true };

export function AutoReplyManager() {
  const rules = useManagerResource<AutoReplyRule>("auto_reply");
  const templates = useManagerResource<WhatsAppTemplate>("templates");
  const flows = useManagerResource<CustomerFlow>("flows");
  const settingsReq = useManagerResource<any>("settings");
  const settings = settingsReq.data?.[0];
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AutoReplyRule | null>(null);
  const form = useForm<AutoReplyFormValues>({ resolver: zodResolver(autoReplySchema), defaultValues: defaults });
  const templateId = useWatch({ control: form.control, name: "template_id" }) ?? "";
  const flowId = useWatch({ control: form.control, name: "flow_id" });
  const phoneId = useWatch({ control: form.control, name: "phone_id" });
  const active = useWatch({ control: form.control, name: "is_active" }) ?? true;

  useEffect(() => {
    if (!open) return;
    form.reset(editing ? { keyword: editing.keyword, phone_id: editing.phone_id, template_id: editing.template_id, flow_id: editing.flow_id, is_active: editing.is_active } : defaults);
  }, [editing, form, open]);

  const submit = form.handleSubmit(async (values) => {
    try {
      const result = editing ? await updateManagerResource<AutoReplyRule>("auto_reply", editing.id, values) : await createManagerResource<AutoReplyRule>("auto_reply", values);
      toast.success(result.message ?? "Auto reply tersimpan"); setOpen(false); await rules.refresh();
    } catch (submitError) { toast.error(submitError instanceof Error ? submitError.message : "Gagal menyimpan auto reply"); }
  });
  const remove = async (id: string) => {
    try { await deleteManagerResource("auto_reply", id); toast.success("Auto reply dihapus"); await rules.refresh(); }
    catch (deleteError) { toast.error(deleteError instanceof Error ? deleteError.message : "Gagal menghapus"); }
  };

  if (rules.loading || templates.loading || flows.loading || settingsReq.loading) return <ResourceLoading />;
  if (rules.error || templates.error || flows.error || settingsReq.error) return <ResourceError message={rules.error ?? templates.error ?? flows.error ?? settingsReq.error ?? "Gagal memuat data"} />;
  return (
    <div className="space-y-6">
      <PageHeading title="Balas Cepat" description="Daftar balasan cepat (snippets) yang bisa dipicu oleh Automation." icon={MessageCircleReply} action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus />Balasan</Button>} />
      {rules.data.length === 0 ? <EmptyState title="Belum ada balas cepat" description="Tambahkan snippet pesan yang akan dihubungkan dengan Automation." /> : <div className="grid gap-3 max-w-full">{rules.data.map((rule) => <Card key={rule.id} className="rounded-xl border-border/60 overflow-hidden"><CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center max-w-full"><div className="flex flex-1 items-center gap-3 overflow-hidden"><div className="min-w-0 flex-1"><p className="font-medium truncate">{rule.template?.name ?? "Template tidak tersedia"}</p><p className="text-xs text-muted-foreground truncate">Masuk flow: {rule.flow?.name ?? "Tidak ditentukan"} • Akun: {!rule.phone_id ? "Semua" : rule.phone_id === settings?.admin_phone_id ? "Admin Utama" : rule.phone_id === settings?.bot_phone_id ? "Bot" : rule.phone_id}</p></div></div><div className="shrink-0"><StatusBadge status={rule.is_active ? "active" : "inactive"} label={rule.is_active ? "Aktif" : "Nonaktif"} /></div><div className="flex shrink-0"><Button size="icon" variant="ghost" onClick={() => { setEditing(rule); setOpen(true); }}><Pencil /></Button><DeleteConfirmation label={"Balasan Cepat"} onConfirm={() => remove(rule.id)} /></div></CardContent></Card>)}</div>}

      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-[95vw] sm:max-w-md overflow-hidden"><DialogHeader><DialogTitle>{editing ? "Edit Balas Cepat" : "Balasan Baru"}</DialogTitle><DialogDescription>Pilih template dan target akun untuk balasan ini.</DialogDescription></DialogHeader><form onSubmit={submit} className="space-y-4">
        {/* Keyword hidden, it is no longer used but kept for db compatibility */}
        <input type="hidden" {...form.register("keyword")} />
        <div className="space-y-2"><Label>Target Akun (Nomor yang Dihubungi)</Label><Select value={phoneId ?? "all"} onValueChange={(val) => form.setValue("phone_id", val === "all" ? null : val)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua Nomor</SelectItem>{settings?.admin_phone_id && <SelectItem value={settings.admin_phone_id}>Admin Utama ({settings.admin_phone_number || settings.admin_phone_id})</SelectItem>}{settings?.bot_phone_id && <SelectItem value={settings.bot_phone_id}>Akun Bot ({settings.bot_phone_number || settings.bot_phone_id})</SelectItem>}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Template</Label><Select value={templateId} onValueChange={(value) => form.setValue("template_id", value, { shouldValidate: true })}><SelectTrigger><SelectValue placeholder="Pilih template" /></SelectTrigger><SelectContent>{templates.data.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Flow</Label><Select value={flowId ?? "none"} onValueChange={(value) => form.setValue("flow_id", value === "none" ? null : value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Tidak ditentukan</SelectItem>{flows.data.map((flow) => <SelectItem key={flow.id} value={flow.id}>{flow.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="flex items-center justify-between rounded-xl border p-3"><Label htmlFor="reply-active">Aktif</Label><Switch id="reply-active" checked={active} onCheckedChange={(checked) => form.setValue("is_active", checked)} /></div>
        <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" disabled={form.formState.isSubmitting}>Simpan</Button></DialogFooter>
      </form></DialogContent></Dialog>
    </div>
  );
}
