"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { ArrowDown, Bot, Pencil, Plus } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DeleteConfirmation } from "@/components/whatsapp/delete-confirmation";
import { PageHeading } from "@/components/whatsapp/page-heading";
import { EmptyState, ResourceError, ResourceLoading } from "@/components/whatsapp/resource-state";
import { StatusBadge } from "@/components/whatsapp/status-badge";
import { AUTOMATION_ACTIONS, AUTOMATION_TRIGGERS } from "@/constants/whatsapp-manager";
import { useManagerResource } from "@/hooks/use-manager-resource";
import { createManagerResource, deleteManagerResource, updateManagerResource } from "@/services/whatsapp-manager-client";
import type { AutomationRule, WhatsAppTemplate } from "@/types/whatsapp-manager";
import { automationSchema, type AutomationFormValues } from "@/validation/whatsapp-manager";

const defaults: AutomationFormValues = {
  name: "", trigger_type: "Saat pesan masuk", condition_field: "keyword",
  condition_operator: "equals", condition_value: "", action_type: "Kirim template",
  action_config_value: "", template_id: null, is_active: true,
};

export function AutomationManager() {
  const automation = useManagerResource<AutomationRule>("automation");
  const templates = useManagerResource<WhatsAppTemplate>("templates");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AutomationRule | null>(null);
  const form = useForm<AutomationFormValues>({ resolver: zodResolver(automationSchema), defaultValues: defaults });
  const triggerType = useWatch({ control: form.control, name: "trigger_type" }) ?? defaults.trigger_type;
  const conditionOperator = useWatch({ control: form.control, name: "condition_operator" }) ?? defaults.condition_operator;
  const actionType = useWatch({ control: form.control, name: "action_type" }) ?? defaults.action_type;
  const templateId = useWatch({ control: form.control, name: "template_id" });
  const active = useWatch({ control: form.control, name: "is_active" }) ?? true;

  useEffect(() => {
    if (!open) return;
    if (!editing) return form.reset(defaults);
    form.reset({
      name: editing.name,
      trigger_type: editing.trigger_type,
      condition_field: editing.condition_config.field ?? "keyword",
      condition_operator: editing.condition_config.operator ?? "equals",
      condition_value: editing.condition_config.value ?? "",
      action_type: editing.action_type,
      action_config_value: editing.action_config.value ?? "",
      template_id: editing.template_id,
      is_active: editing.is_active,
    });
  }, [editing, form, open]);

  const submit = form.handleSubmit(async (values) => {
    try {
      const result = editing
        ? await updateManagerResource<AutomationRule>("automation", editing.id, values)
        : await createManagerResource<AutomationRule>("automation", values);
      toast.success(result.message ?? "Automation tersimpan"); setOpen(false); await automation.refresh();
    } catch (submitError) { toast.error(submitError instanceof Error ? submitError.message : "Gagal menyimpan automation"); }
  });

  const remove = async (id: string) => {
    try { await deleteManagerResource("automation", id); toast.success("Automation dihapus"); await automation.refresh(); }
    catch (deleteError) { toast.error(deleteError instanceof Error ? deleteError.message : "Gagal menghapus"); }
  };

  if (automation.loading || templates.loading) return <ResourceLoading />;
  if (automation.error || templates.error) return <ResourceError message={automation.error ?? templates.error ?? "Gagal memuat data"} />;

  return (
    <div className="space-y-6">
      <PageHeading title="Automation" description="Konfigurasikan Trigger → Condition → Action. Eksekusi tetap dilakukan backend." icon={Bot} action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus />Automation</Button>} />
      {automation.data.length === 0 ? <EmptyState title="Belum ada automation" description="Tambahkan rule pertama untuk menjalankan template berdasarkan trigger." /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {automation.data.map((rule) => (
            <Card key={rule.id} className="rounded-xl border-border/60">
              <CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle className="text-base">{rule.name}</CardTitle><div className="mt-2"><StatusBadge status={rule.is_active ? "active" : "inactive"} label={rule.is_active ? "Aktif" : "Nonaktif"} /></div></div><div className="flex"><Button size="icon" variant="ghost" onClick={() => { setEditing(rule); setOpen(true); }}><Pencil /></Button><DeleteConfirmation label={rule.name} onConfirm={() => remove(rule.id)} /></div></CardHeader>
              <CardContent>
                <div className="grid gap-2 text-sm">
                  <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs uppercase text-muted-foreground">Trigger</p><p className="mt-1 font-medium">{rule.trigger_type}</p></div>
                  <ArrowDown className="mx-auto h-4 w-4 text-primary" />
                  <div className="rounded-xl border bg-muted/30 p-3"><p className="text-xs uppercase text-muted-foreground">Condition</p><p className="mt-1 font-medium">{rule.condition_config.field} {rule.condition_config.operator} “{rule.condition_config.value}”</p></div>
                  <ArrowDown className="mx-auto h-4 w-4 text-primary" />
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3"><p className="text-xs uppercase text-muted-foreground">Action</p><p className="mt-1 font-medium">{rule.action_type}{rule.template?.name ? ` · ${rule.template.name}` : ""}</p></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editing ? "Edit Automation" : "Automation Baru"}</DialogTitle><DialogDescription>Automation hanya menyimpan konfigurasi dan tidak mengirim pesan dari browser.</DialogDescription></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2"><Label htmlFor="automation-name">Nama</Label><Input id="automation-name" {...form.register("name")} />{form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}</div>
            <div className="space-y-2"><Label>Trigger</Label><Select value={triggerType} onValueChange={(value) => form.setValue("trigger_type", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{AUTOMATION_TRIGGERS.map((trigger) => <SelectItem key={trigger} value={trigger}>{trigger}</SelectItem>)}</SelectContent></Select></div>
            <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-3"><div className="space-y-2"><Label>Field</Label><Input {...form.register("condition_field")} /></div><div className="space-y-2"><Label>Operator</Label><Select value={conditionOperator} onValueChange={(value) => form.setValue("condition_operator", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="equals">equals</SelectItem><SelectItem value="contains">contains</SelectItem><SelectItem value="not_equals">not equals</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Value</Label><Input {...form.register("condition_value")} /></div></div>
            <div className="space-y-2"><Label>Action</Label><Select value={actionType} onValueChange={(value) => form.setValue("action_type", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{AUTOMATION_ACTIONS.map((action) => <SelectItem key={action} value={action}>{action}</SelectItem>)}</SelectContent></Select></div>
            
            {["Kirim template", "Kirim quick reply"].includes(actionType) && (
              <div className="space-y-3">
                {actionType === "Kirim quick reply" && (
                  <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                    <span className="font-bold">Catatan:</span> Quick reply hanya bisa dikirim jika percakapan masih di dalam jendela 24 jam WhatsApp. Di luar jendela, aksi ini akan di-skip. Untuk pengiriman di luar jendela, tambahkan aksi <span className="font-bold">Kirim template</span> sebagai fallback.
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Template</Label>
                  <Select value={templateId ?? "none"} onValueChange={(value) => form.setValue("template_id", value === "none" ? null : value)}>
                    <SelectTrigger><SelectValue placeholder="Pilih template" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Tanpa template</SelectItem>
                      {templates.data.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {actionType === "Kirim quick reply" && <p className="text-xs text-muted-foreground mt-1">Hanya quick reply team-wide yang muncul. Snippet personal tidak bisa dipakai oleh rule otomasi.</p>}
                </div>
              </div>
            )}

            {["Tambah label", "Hapus label", "Assign", "Ubah prioritas", "Ubah status", "Kirim notifikasi"].includes(actionType) && (
              <div className="space-y-2">
                <Label>{actionType}</Label>
                <Input placeholder="Nilai..." {...form.register("action_config_value")} />
              </div>
            )}

            {actionType === "Tunggu" && (
              <div className="space-y-2">
                <Label>Waktu Tunggu (Menit)</Label>
                <Input type="number" placeholder="60" {...form.register("action_config_value")} />
              </div>
            )}
            <div className="flex items-center justify-between rounded-xl border p-3"><Label htmlFor="automation-active">Aktif</Label><Switch id="automation-active" checked={active} onCheckedChange={(checked) => form.setValue("is_active", checked)} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
