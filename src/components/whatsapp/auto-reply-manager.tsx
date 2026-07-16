"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import { MessageCircleReply, Pencil, Plus } from "lucide-react";
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
import type { WhatsAppTemplate } from "@/types/whatsapp-manager";
import { autoReplySchema, type AutoReplyFormValues } from "@/validation/whatsapp-manager";

// We need to define AutoReplyRule specifically for the frontend because it has different fields now
export interface AutoReplyRule {
  id: string;
  keyword: string;
  match_type: "equals" | "contains" | "starts_with";
  template_id: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  template?: Pick<WhatsAppTemplate, "id" | "name"> | null;
}

const defaults: AutoReplyFormValues = { keyword: "", match_type: "contains", template_id: "", is_active: true };

export function AutoReplyManager() {
  const rules = useManagerResource<AutoReplyRule>("auto_reply");
  const templates = useManagerResource<WhatsAppTemplate>("templates");
  
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AutoReplyRule | null>(null);
  
  const form = useForm<AutoReplyFormValues>({ resolver: zodResolver(autoReplySchema), defaultValues: defaults });
  const templateId = useWatch({ control: form.control, name: "template_id" }) ?? "";
  const matchType = useWatch({ control: form.control, name: "match_type" }) ?? "contains";
  const active = useWatch({ control: form.control, name: "is_active" }) ?? true;

  useEffect(() => {
    if (!open) return;
    form.reset(editing ? { 
      keyword: editing.keyword, 
      match_type: editing.match_type || "contains", 
      template_id: editing.template_id, 
      is_active: editing.is_active 
    } : defaults);
  }, [editing, form, open]);

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
    }
    catch (deleteError) { 
      toast.error(deleteError instanceof Error ? deleteError.message : "Gagal menghapus"); 
    }
  };

  if (rules.loading || templates.loading) return <ResourceLoading />;
  if (rules.error || templates.error) return <ResourceError message={rules.error ?? templates.error ?? "Gagal memuat data"} />;
  
  return (
    <div className="space-y-6">
      <PageHeading 
        title="Balas Cepat (Auto Reply)" 
        description="Balas otomatis pesan customer berdasarkan keyword yang dikirim." 
        icon={MessageCircleReply} 
        action={<Button onClick={() => { setEditing(null); setOpen(true); }}><Plus />Balasan Baru</Button>} 
      />
      
      {rules.data.length === 0 ? (
        <EmptyState title="Belum ada auto reply" description="Tambahkan rule balasan otomatis berdasarkan keyword." />
      ) : (
        <div className="grid gap-3 max-w-full">
          {rules.data.map((rule) => (
            <Card key={rule.id} className="rounded-xl border-border/60 overflow-hidden">
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center max-w-full">
                <div className="flex flex-1 items-center gap-3 overflow-hidden">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-primary px-2 py-0.5 bg-primary/10 rounded text-sm">
                        {rule.keyword}
                      </span>
                      <span className="text-xs text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
                        {rule.match_type || 'contains'}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate flex items-center gap-2">
                      <ArrowRightIcon className="w-3 h-3" />
                      {rule.template?.name ?? "Template tidak tersedia"}
                    </p>
                  </div>
                </div>
                <div className="shrink-0">
                  <StatusBadge status={rule.is_active ? "active" : "inactive"} label={rule.is_active ? "Aktif" : "Nonaktif"} />
                </div>
                <div className="flex shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => { setEditing(rule); setOpen(true); }}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <DeleteConfirmation label={`Auto Reply "${rule.keyword}"`} onConfirm={() => remove(rule.id)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md overflow-hidden">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Auto Reply" : "Auto Reply Baru"}</DialogTitle>
            <DialogDescription>Balasan otomatis akan dikirim dari nomor Admin Utama.</DialogDescription>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            
            <div className="space-y-2">
              <Label>Keyword</Label>
              <Input placeholder="Contoh: harga, lokasi, halo" {...form.register("keyword")} />
              {form.formState.errors.keyword && <p className="text-xs text-destructive">{form.formState.errors.keyword.message}</p>}
            </div>

            <div className="space-y-2">
              <Label>Tipe Pencocokan</Label>
              <Select value={matchType} onValueChange={(val: any) => form.setValue("match_type", val)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equals">Sama Persis (Equals)</SelectItem>
                  <SelectItem value="contains">Mengandung Kata (Contains)</SelectItem>
                  <SelectItem value="starts_with">Berawalan Kata (Starts With)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Kirim Template</Label>
              <Select value={templateId} onValueChange={(value) => form.setValue("template_id", value, { shouldValidate: true })}>
                <SelectTrigger><SelectValue placeholder="Pilih template" /></SelectTrigger>
                <SelectContent>
                  {templates.data.map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}
                </SelectContent>
              </Select>
              {form.formState.errors.template_id && <p className="text-xs text-destructive">{form.formState.errors.template_id.message}</p>}
            </div>
            
            <div className="flex items-center justify-between rounded-xl border p-3">
              <Label htmlFor="reply-active">Status Aktif</Label>
              <Switch id="reply-active" checked={active} onCheckedChange={(checked) => form.setValue("is_active", checked)} />
            </div>
            
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ArrowRightIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  )
}
