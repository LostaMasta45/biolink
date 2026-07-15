"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { FileText, Pencil, Plus } from "lucide-react";
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
import { DeleteConfirmation } from "@/components/whatsapp/delete-confirmation";
import { PageHeading } from "@/components/whatsapp/page-heading";
import { EmptyState, ResourceError, ResourceLoading } from "@/components/whatsapp/resource-state";
import { TEMPLATE_TYPES, TEMPLATE_TYPE_LABELS } from "@/constants/whatsapp-manager";
import { useManagerResource } from "@/hooks/use-manager-resource";
import { createManagerResource, deleteManagerResource, updateManagerResource } from "@/services/whatsapp-manager-client";
import type { TemplateFormValues } from "@/validation/whatsapp-manager";
import { templateSchema } from "@/validation/whatsapp-manager";
import type { WhatsAppTemplate } from "@/types/whatsapp-manager";

const defaults: TemplateFormValues = {
  name: "",
  category: "General",
  type: "text",
  header: "",
  body: "",
  footer: "",
  media_url: "",
  buttons: [],
  sections: [],
  is_active: true,
};

export function TemplateManager() {
  const { data, loading, error, refresh } = useManagerResource<WhatsAppTemplate>("templates");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WhatsAppTemplate | null>(null);
  const form = useForm<TemplateFormValues>({ resolver: zodResolver(templateSchema), defaultValues: defaults });
  const buttons = useFieldArray({ control: form.control, name: "buttons" });
  const sections = useFieldArray({ control: form.control, name: "sections" });
  const type = useWatch({ control: form.control, name: "type" }) ?? "text";
  const active = useWatch({ control: form.control, name: "is_active" }) ?? true;
  const watchedSections = useWatch({ control: form.control, name: "sections" }) ?? [];

  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.name, category: editing.category, type: editing.type,
        header: editing.header ?? "", body: editing.body, footer: editing.footer ?? "",
        media_url: editing.media_url ?? "", buttons: editing.buttons, sections: editing.sections,
        is_active: editing.is_active,
      });
    } else form.reset(defaults);
  }, [editing, form, open]);

  const showCreate = () => { setEditing(null); setOpen(true); };
  const showEdit = (template: WhatsAppTemplate) => { setEditing(template); setOpen(true); };

  const submit = form.handleSubmit(async (values) => {
    try {
      const result = editing
        ? await updateManagerResource<WhatsAppTemplate>("templates", editing.id, values)
        : await createManagerResource<WhatsAppTemplate>("templates", values);
      toast.success(result.message ?? "Template tersimpan");
      setOpen(false);
      await refresh();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Gagal menyimpan template");
    }
  });

  const remove = async (id: string) => {
    try { await deleteManagerResource("templates", id); toast.success("Template dihapus"); await refresh(); }
    catch (deleteError) { toast.error(deleteError instanceof Error ? deleteError.message : "Gagal menghapus"); }
  };

  if (loading) return <ResourceLoading />;
  if (error) return <ResourceError message={error} />;

  return (
    <div className="space-y-6">
      <PageHeading title="Templates" description="Simpan isi pesan; backend menerjemahkannya menjadi payload Kirim.dev." icon={FileText} action={<Button onClick={showCreate}><Plus />Template</Button>} />
      {data.length === 0 ? <EmptyState title="Belum ada template" description="Buat template pertama untuk dipakai automation dan flow." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 max-w-full">
          {data.map((template) => (
            <Card key={template.id} className="rounded-xl border-border/60 bg-card/80">
              <CardHeader className="flex-row items-start justify-between space-y-0">
                <div><CardTitle className="text-base">{template.name}</CardTitle><div className="mt-2 flex gap-2"><Badge variant="outline">{TEMPLATE_TYPE_LABELS[template.type]}</Badge><Badge variant="secondary">{template.category}</Badge></div></div>
                <div className="flex"><Button size="icon" variant="ghost" onClick={() => showEdit(template)} aria-label={`Edit ${template.name}`}><Pencil /></Button><DeleteConfirmation label={template.name} onConfirm={() => remove(template.id)} /></div>
              </CardHeader>
              <CardContent className="overflow-hidden">
                <div className="rounded-xl border bg-emerald-950/20 p-4 overflow-hidden"><p className="line-clamp-5 whitespace-pre-wrap break-words text-sm">{template.body}</p>{template.footer && <p className="mt-3 text-xs text-muted-foreground truncate">{template.footer}</p>}</div>
                <p className="mt-3 text-xs text-muted-foreground">{template.is_active ? "Aktif" : "Nonaktif"} · Diperbarui {new Date(template.updated_at).toLocaleDateString("id-ID")}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-[95vw] sm:max-w-3xl overflow-x-hidden overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit Template" : "Template Baru"}</DialogTitle><DialogDescription>Field berubah sesuai jenis template yang dipilih.</DialogDescription></DialogHeader>
          <form onSubmit={submit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="template-name">Nama</Label><Input id="template-name" {...form.register("name")} />{form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}</div>
              <div className="space-y-2"><Label htmlFor="template-category">Kategori</Label><Input id="template-category" {...form.register("category")} /></div>
            </div>
            <div className="space-y-2"><Label>Jenis</Label><Select value={type} onValueChange={(value) => form.setValue("type", value as TemplateFormValues["type"], { shouldValidate: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TEMPLATE_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            
            {/* Opsi Header untuk tipe teks atau interaktif */}
            {["text", "reply_button", "url_button", "list"].includes(type) && (
              <div className="space-y-2 rounded-xl border p-3">
                <div className="flex items-center justify-between mb-2">
                  <Label>Header (Opsional)</Label>
                  {["reply_button", "list"].includes(type) && (
                     <p className="text-xs text-muted-foreground">Bisa berupa teks atau URL Media.</p>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Teks Header</Label>
                    <Input placeholder="Teks singkat..." {...form.register("header")} />
                  </div>
                  {["reply_button", "list"].includes(type) && (
                    <div className="space-y-1">
                      <Label className="text-xs">Atau Media URL Header (Meta API)</Label>
                      <Input placeholder="https://...jpg" {...form.register("media_url")} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Opsi Media URL Khusus tipe Media Standar */}
            {["image", "video", "document"].includes(type) && <div className="space-y-2"><Label htmlFor="media-url">URL Media</Label><Input id="media-url" placeholder="https://..." {...form.register("media_url")} />{form.formState.errors.media_url && <p className="text-xs text-destructive">{form.formState.errors.media_url.message}</p>}</div>}
            
            <div className="space-y-2"><Label htmlFor="template-body">{["image", "video", "document"].includes(type) ? "Caption / Body" : "Teks Utama (Body)"}</Label><Textarea id="template-body" rows={5} {...form.register("body")} />{form.formState.errors.body && <p className="text-xs text-destructive">{form.formState.errors.body.message}</p>}</div>
            
            {["text", "reply_button", "url_button", "list"].includes(type) && <div className="space-y-2"><Label htmlFor="template-footer">Footer (Opsional)</Label><Input id="template-footer" placeholder="Teks kecil di bawah pesan..." {...form.register("footer")} /></div>}

            {["reply_button", "url_button"].includes(type) && <div className="space-y-3"><div className="flex items-center justify-between"><Label>Buttons</Label><Button type="button" size="sm" variant="outline" disabled={buttons.fields.length >= 3} onClick={() => buttons.append({ id: crypto.randomUUID(), label: "", url: "" })}><Plus />Tombol</Button></div>{buttons.fields.map((field, index) => <div key={field.id} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_auto]"><Input placeholder="Label" {...form.register(`buttons.${index}.label`)} />{type === "url_button" ? <Input placeholder="https://..." {...form.register(`buttons.${index}.url`)} /> : <div />}<Button type="button" variant="ghost" onClick={() => buttons.remove(index)}>Hapus</Button></div>)}{form.formState.errors.buttons?.root && <p className="text-xs text-destructive">{form.formState.errors.buttons.root.message}</p>}</div>}

            {type === "list" && <div className="space-y-3"><div className="flex items-center justify-between"><Label>Sections & Rows</Label><Button type="button" size="sm" variant="outline" onClick={() => sections.append({ title: "", rows: [{ id: crypto.randomUUID(), title: "", description: "" }] })}><Plus />Section</Button></div>{sections.fields.map((section, sectionIndex) => <div key={section.id} className="space-y-2 rounded-xl border p-3"><Input placeholder="Judul section" {...form.register(`sections.${sectionIndex}.title`)} />{watchedSections[sectionIndex]?.rows?.map((row, rowIndex) => <div key={row.id} className="grid gap-2 sm:grid-cols-2"><Input placeholder="Judul row" {...form.register(`sections.${sectionIndex}.rows.${rowIndex}.title`)} /><Input placeholder="Deskripsi" {...form.register(`sections.${sectionIndex}.rows.${rowIndex}.description`)} /></div>)}<div className="flex gap-2"><Button type="button" size="sm" variant="outline" onClick={() => { const current = form.getValues(`sections.${sectionIndex}.rows`) ?? []; form.setValue(`sections.${sectionIndex}.rows`, [...current, { id: crypto.randomUUID(), title: "", description: "" }]); }}>Tambah row</Button><Button type="button" size="sm" variant="ghost" onClick={() => sections.remove(sectionIndex)}>Hapus section</Button></div></div>)}</div>}

            <div className="flex items-center justify-between rounded-xl border p-3"><div><Label htmlFor="template-active">Template aktif</Label><p className="text-xs text-muted-foreground">Template nonaktif tidak dipakai automation.</p></div><Switch id="template-active" checked={active} onCheckedChange={(checked) => form.setValue("is_active", checked)} /></div>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Menyimpan..." : "Simpan"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
