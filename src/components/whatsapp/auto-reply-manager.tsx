"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch, type UseFormRegisterReturn } from "react-hook-form";
import { Clock3, MessageCircleReply, Pencil, Plus, ShieldCheck } from "lucide-react";
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

const defaults: AutoReplyFormValues = {
  keyword: "",
  template_id: "",
  flow_id: null,
  match_type: "equals",
  delay_seconds: 1,
  cooldown_seconds: 60,
  priority: 0,
  schedule_mode: "always",
  handover_to_human: false,
  handover_duration_minutes: 480,
  is_test_mode: false,
  test_phone_numbers: [],
  is_active: true,
};

const MATCH_LABELS = { equals: "Sama persis", contains: "Mengandung", starts_with: "Diawali" } as const;
const SCHEDULE_LABELS = { always: "Setiap saat", business_hours: "Jam kerja", outside_hours: "Di luar jam kerja" } as const;

export function AutoReplyManager() {
  const rules = useManagerResource<AutoReplyRule>("auto_reply");
  const templates = useManagerResource<WhatsAppTemplate>("templates");
  const flows = useManagerResource<CustomerFlow>("flows");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AutoReplyRule | null>(null);
  const [testPhoneInput, setTestPhoneInput] = useState("");
  const form = useForm<AutoReplyFormValues>({ resolver: zodResolver(autoReplySchema), defaultValues: defaults });
  const templateId = useWatch({ control: form.control, name: "template_id" }) ?? "";
  const flowId = useWatch({ control: form.control, name: "flow_id" });
  const matchType = useWatch({ control: form.control, name: "match_type" }) ?? "equals";
  const scheduleMode = useWatch({ control: form.control, name: "schedule_mode" }) ?? "always";
  const active = useWatch({ control: form.control, name: "is_active" }) ?? true;
  const handover = useWatch({ control: form.control, name: "handover_to_human" }) ?? false;
  const testMode = useWatch({ control: form.control, name: "is_test_mode" }) ?? false;

  const openRule = (rule: AutoReplyRule | null) => {
    setEditing(rule);
    const values = rule ? {
      keyword: rule?.keyword ?? "",
      template_id: rule?.template_id ?? "",
      flow_id: rule?.flow_id ?? null,
      match_type: rule?.match_type ?? "equals",
      delay_seconds: rule?.delay_seconds ?? 1,
      cooldown_seconds: rule?.cooldown_seconds ?? 60,
      priority: rule?.priority ?? 0,
      schedule_mode: rule?.schedule_mode ?? "always",
      handover_to_human: rule?.handover_to_human ?? false,
      handover_duration_minutes: rule?.handover_duration_minutes ?? 480,
      is_test_mode: rule?.is_test_mode ?? false,
      test_phone_numbers: rule?.test_phone_numbers ?? [],
      is_active: rule?.is_active ?? true,
    } : defaults;
    form.reset(values);
    setTestPhoneInput(values.test_phone_numbers.join(", "));
    setOpen(true);
  };

  const submit = form.handleSubmit(async (values) => {
    try {
      const result = editing
        ? await updateManagerResource<AutoReplyRule>("auto_reply", editing.id, values)
        : await createManagerResource<AutoReplyRule>("auto_reply", values);
      toast.success(result.message ?? "Auto reply tersimpan");
      setOpen(false);
      await rules.refresh();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Gagal menyimpan auto reply");
    }
  });

  const remove = async (id: string) => {
    try {
      await deleteManagerResource("auto_reply", id);
      toast.success("Auto reply dihapus");
      await rules.refresh();
    } catch (deleteError) {
      toast.error(deleteError instanceof Error ? deleteError.message : "Gagal menghapus");
    }
  };

  if (rules.loading || templates.loading || flows.loading) return <ResourceLoading />;
  if (rules.error || templates.error || flows.error) return <ResourceError message={rules.error ?? templates.error ?? flows.error ?? "Gagal memuat data"} />;

  return (
    <div className="space-y-6">
      <PageHeading
        title="Keyword Automation"
        description="Rule keyword otomatis dengan prioritas, delay, cooldown, jadwal, handover, dan mode test. Balas Cepat manual tersedia di Inbox."
        icon={MessageCircleReply}
        action={<Button onClick={() => openRule(null)}><Plus />Rule Baru</Button>}
      />

      {rules.data.length === 0 ? (
        <EmptyState title="Belum ada rule keyword" description="Tambahkan rule automation berdasarkan keyword customer." />
      ) : (
        <div className="grid gap-3">
          {rules.data.map((rule) => (
            <Card key={rule.id} className="overflow-hidden rounded-xl border-border/60">
              <CardContent className="flex flex-col gap-4 p-4 lg:flex-row lg:items-center">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span className="rounded bg-primary/10 px-2 py-0.5 text-sm font-semibold text-primary">{rule.keyword}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{MATCH_LABELS[rule.match_type]}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">Prioritas {rule.priority}</span>
                    {rule.is_test_mode && <StatusBadge status="pending" label="Test mode" />}
                    {rule.handover_to_human && <StatusBadge status="degraded" label="Handover" />}
                  </div>
                  <p className="truncate text-sm text-muted-foreground">→ {rule.template?.name ?? "Template tidak tersedia"}</p>
                  {rule.flow_id && <p className="mt-1 text-xs text-primary">Memulai Flow Map saat keyword cocok</p>}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1"><Clock3 className="h-3 w-3" />Delay {rule.delay_seconds}s · Cooldown {rule.cooldown_seconds}s</span>
                    <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3" />{SCHEDULE_LABELS[rule.schedule_mode]}</span>
                  </div>
                </div>
                <StatusBadge status={rule.is_active ? "active" : "inactive"} label={rule.is_active ? "Aktif" : "Nonaktif"} />
                <div className="flex shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openRule(rule)}><Pencil className="h-4 w-4" /></Button>
                  <DeleteConfirmation label={`Auto Reply "${rule.keyword}"`} onConfirm={() => remove(rule.id)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-[96vw] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Keyword Automation" : "Keyword Automation Baru"}</DialogTitle>
            <DialogDescription>Balasan customer tetap dikirim dari nomor Admin Utama. Tes koneksi dikirim dari Bot ke Admin.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Keyword</Label>
                <Input autoComplete="off" placeholder="Contoh: pricelist" {...form.register("keyword")} />
                {form.formState.errors.keyword && <p className="text-xs text-destructive">{form.formState.errors.keyword.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Tipe Pencocokan</Label>
                <Select value={matchType} onValueChange={(value: AutoReplyFormValues["match_type"]) => form.setValue("match_type", value)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="equals">Sama persis (aman)</SelectItem><SelectItem value="starts_with">Diawali keyword</SelectItem><SelectItem value="contains">Mengandung keyword</SelectItem></SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Template fallback</Label>
              <Select value={templateId} onValueChange={(value) => form.setValue("template_id", value, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Pilih template" /></SelectTrigger>
                <SelectContent>{templates.data.filter((template) => template.is_active).map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent>
              </Select>
              {form.formState.errors.template_id && <p className="text-xs text-destructive">{form.formState.errors.template_id.message}</p>}
            </div>

            <div className="space-y-2 rounded-xl border border-primary/15 p-4">
              <Label>Mulai Flow Map (opsional)</Label>
              <Select value={flowId ?? "none"} onValueChange={(value) => form.setValue("flow_id", value === "none" ? null : value)}>
                <SelectTrigger><SelectValue placeholder="Tanpa Flow Map" /></SelectTrigger>
                <SelectContent><SelectItem value="none">Tanpa Flow Map — kirim template fallback</SelectItem>{flows.data.filter((flow) => flow.is_active).map((flow) => <SelectItem key={flow.id} value={flow.id}>{flow.name}</SelectItem>)}</SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Jika dipilih, keyword ini memulai node pertama Flow Map. Template fallback dipakai hanya bila Flow Map dilepas kembali.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <NumberField label="Delay (detik)" min={0} max={30} registration={form.register("delay_seconds", { valueAsNumber: true })} />
              <NumberField label="Cooldown (detik)" min={0} max={86400} registration={form.register("cooldown_seconds", { valueAsNumber: true })} />
              <NumberField label="Prioritas" min={-1000} max={1000} registration={form.register("priority", { valueAsNumber: true })} />
            </div>

            <div className="space-y-2">
              <Label>Jadwal Aktif</Label>
              <Select value={scheduleMode} onValueChange={(value: AutoReplyFormValues["schedule_mode"]) => form.setValue("schedule_mode", value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="always">Setiap saat</SelectItem><SelectItem value="business_hours">Hanya jam kerja</SelectItem><SelectItem value="outside_hours">Hanya di luar jam kerja</SelectItem></SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <div><Label htmlFor="handover">Handover ke CS manusia</Label><p className="mt-1 text-xs text-muted-foreground">Setelah template dikirim, automation customer dihentikan sementara.</p></div>
                <Switch id="handover" checked={handover} onCheckedChange={(checked) => form.setValue("handover_to_human", checked)} />
              </div>
              {handover && <div className="mt-3"><NumberField label="Durasi handover (menit)" min={1} max={10080} registration={form.register("handover_duration_minutes", { valueAsNumber: true })} /></div>}
            </div>

            <div className="rounded-xl border p-4">
              <div className="flex items-center justify-between gap-4">
                <div><Label htmlFor="test-mode">Test mode</Label><p className="mt-1 text-xs text-muted-foreground">Hanya nomor allowlist yang dapat memicu rule.</p></div>
                <Switch id="test-mode" checked={testMode} onCheckedChange={(checked) => form.setValue("is_test_mode", checked)} />
              </div>
              {testMode && <div className="mt-3 space-y-2"><Label>Nomor allowlist</Label><Input value={testPhoneInput} onChange={(event) => { setTestPhoneInput(event.target.value); form.setValue("test_phone_numbers", event.target.value.split(/[\s,]+/).map((item) => item.replace(/\D/g, "")).filter(Boolean), { shouldValidate: true }); }} placeholder="62812..., 62813..." /><p className="text-xs text-muted-foreground">Pisahkan nomor dengan koma.</p></div>}
            </div>

            <div className="flex items-center justify-between rounded-xl border p-3">
              <Label htmlFor="reply-active">Status Aktif</Label>
              <Switch id="reply-active" checked={active} onCheckedChange={(checked) => form.setValue("is_active", checked)} />
            </div>

            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NumberField({ label, min, max, registration }: { label: string; min: number; max: number; registration: UseFormRegisterReturn }) {
  return <div className="space-y-2"><Label>{label}</Label><Input type="number" min={min} max={max} {...registration} /></div>;
}
