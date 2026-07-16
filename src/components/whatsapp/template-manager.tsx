"use client";

import { useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useFieldArray, useForm, useWatch, type UseFormRegister, type UseFormRegisterReturn } from "react-hook-form";
import { ExternalLink, FileText, Info, Pencil, Plus } from "lucide-react";
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
import type { InteractiveHeaderType, TemplateType, WhatsAppTemplate } from "@/types/whatsapp-manager";
import { templateSchema, type TemplateFormValues } from "@/validation/whatsapp-manager";

const defaults: TemplateFormValues = {
  name: "",
  category: "Customer Service",
  type: "text",
  header_type: "none",
  header: "",
  body: "",
  footer: "",
  media_url: "",
  preview_url: false,
  filename: "",
  list_button_text: "Lihat pilihan",
  buttons: [],
  sections: [],
  carousel_cards: [],
  usage_context: "",
  is_active: true,
};

const TYPE_GUIDANCE: Record<TemplateType, { description: string; fields: string[] }> = {
  text: { description: "Pesan teks biasa. KirimDev/Meta tidak menyediakan header atau footer untuk tipe text.", fields: ["Body 1–4096", "Preview URL opsional"] },
  image: { description: "Gambar standalone dengan URL publik dan caption opsional.", fields: ["JPEG/PNG", "≤ 5 MB", "Caption ≤ 1024"] },
  video: { description: "Video standalone dengan URL publik dan caption opsional.", fields: ["MP4/3GP", "≤ 16 MB", "Caption ≤ 1024"] },
  audio: { description: "Audio standalone. Tidak mendukung caption, header, atau footer.", fields: ["URL audio publik", "Tanpa caption"] },
  document: { description: "Dokumen standalone dengan caption dan nama file opsional.", fields: ["≤ 100 MB", "Caption ≤ 1024", "Filename opsional"] },
  reply_button: { description: "Pesan interaktif dengan 1–3 tombol balasan.", fields: ["Header teks/media", "Body ≤ 1024", "Footer ≤ 60", "Tombol ≤ 20"] },
  url_button: { description: "Pesan interaktif dengan tepat satu tombol CTA URL.", fields: ["Header teks/media", "Body ≤ 1024", "Footer ≤ 60", "1 URL"] },
  list: { description: "Daftar pilihan. Meta hanya menerima header teks pada tipe list.", fields: ["Header teks", "Body ≤ 1024", "Footer ≤ 60", "Maks. 10 section"] },
  carousel: { description: "Carousel 2–10 card. Tidak memiliki header/footer global; setiap card wajib memakai gambar atau video.", fields: ["Body global ≤ 1024", "Card body ≤ 160", "CTA/quick reply"] },
};

function emptyCarouselCard() {
  const id = crypto.randomUUID();
  return { id, header_type: "image" as const, media_url: "", body: "", action_type: "cta_url" as const, button_id: `card_${id.slice(0, 8)}`, button_label: "Lihat", button_url: "" };
}

export function TemplateManager() {
  const { data, loading, error, refresh } = useManagerResource<WhatsAppTemplate>("templates");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WhatsAppTemplate | null>(null);
  const form = useForm<TemplateFormValues>({ resolver: zodResolver(templateSchema), defaultValues: defaults });
  const buttons = useFieldArray({ control: form.control, name: "buttons" });
  const sections = useFieldArray({ control: form.control, name: "sections" });
  const carousel = useFieldArray({ control: form.control, name: "carousel_cards" });
  const type = useWatch({ control: form.control, name: "type" }) ?? "text";
  const headerType = useWatch({ control: form.control, name: "header_type" }) ?? "none";
  const active = useWatch({ control: form.control, name: "is_active" }) ?? true;
  const previewUrl = useWatch({ control: form.control, name: "preview_url" }) ?? false;
  const watchedSections = useWatch({ control: form.control, name: "sections" }) ?? [];
  const watchedCards = useWatch({ control: form.control, name: "carousel_cards" }) ?? [];
  const body = useWatch({ control: form.control, name: "body" }) ?? "";

  const openTemplate = (template: WhatsAppTemplate | null) => {
    setEditing(template);
    form.reset(template ? {
      name: template.name,
      category: template.category,
      type: template.type,
      header_type: template.header_type ?? "none",
      header: template.header ?? "",
      body: template.body ?? "",
      footer: template.footer ?? "",
      media_url: template.media_url ?? "",
      preview_url: template.preview_url ?? false,
      filename: template.filename ?? "",
      list_button_text: template.list_button_text ?? "Lihat pilihan",
      buttons: template.buttons ?? [],
      sections: template.sections ?? [],
      carousel_cards: template.carousel_cards ?? [],
      usage_context: template.usage_context ?? "",
      is_active: template.is_active,
    } : defaults);
    setOpen(true);
  };

  const changeType = (value: TemplateType) => {
    form.setValue("type", value, { shouldValidate: true });
    const allowedHeaders = value === "list" ? ["none", "text"] : ["reply_button", "url_button"].includes(value) ? ["none", "text", "image", "video", "document"] : ["none"];
    if (!allowedHeaders.includes(form.getValues("header_type"))) form.setValue("header_type", "none");
    if (value === "url_button" && buttons.fields.length > 1) form.setValue("buttons", form.getValues("buttons").slice(0, 1));
    if (value === "carousel" && carousel.fields.length < 2) form.setValue("carousel_cards", [emptyCarouselCard(), emptyCarouselCard()]);
  };

  const submit = form.handleSubmit(async (values) => {
    try {
      const result = editing
        ? await updateManagerResource<WhatsAppTemplate>("templates", editing.id, values)
        : await createManagerResource<WhatsAppTemplate>("templates", values);
      toast.success(result.message ?? "Pesan tersimpan");
      setOpen(false);
      await refresh();
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Gagal menyimpan pesan");
    }
  });

  const remove = async (id: string) => {
    try { await deleteManagerResource("templates", id); toast.success("Pesan tersimpan dihapus"); await refresh(); }
    catch (deleteError) { toast.error(deleteError instanceof Error ? deleteError.message : "Gagal menghapus"); }
  };

  if (loading) return <ResourceLoading />;
  if (error) return <ResourceError message={error} />;
  const guide = TYPE_GUIDANCE[type];
  const bodyLimit = type === "text" ? 4096 : ["image", "video", "document", "reply_button", "url_button", "list", "carousel"].includes(type) ? 1024 : 0;
  const supportsHeader = ["reply_button", "url_button", "list"].includes(type);
  const supportsFooter = ["reply_button", "url_button", "list"].includes(type);

  return (
    <div className="space-y-6">
      <PageHeading title="Pesan Tersimpan" description="Susun payload WhatsApp yang valid untuk auto reply sesuai KirimDev dan Meta." icon={FileText} action={<Button onClick={() => openTemplate(null)}><Plus />Pesan Baru</Button>} />
      <Card className="rounded-xl border-blue-500/20 bg-blue-500/5"><CardContent className="flex gap-3 p-4"><Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-500" /><div className="text-sm"><p className="font-medium">Ini adalah pesan sesi untuk auto reply customer, bukan pembuatan template Meta-approved.</p><p className="mt-1 text-muted-foreground">Mark as read dan typing indicator berada di Settings karena membutuhkan wamid pesan masuk, bukan isi template.</p></div></CardContent></Card>

      {data.length === 0 ? <EmptyState title="Belum ada pesan tersimpan" description="Buat pesan pertama untuk dipakai Auto Reply." /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.map((template) => <Card key={template.id} className="rounded-xl border-border/60 bg-card/80"><CardHeader className="flex-row items-start justify-between space-y-0"><div><CardTitle className="text-base">{template.name}</CardTitle><div className="mt-2 flex flex-wrap gap-2"><Badge variant="outline">{TEMPLATE_TYPE_LABELS[template.type]}</Badge><Badge variant="secondary">{template.category}</Badge></div></div><div className="flex"><Button size="icon" variant="ghost" onClick={() => openTemplate(template)} aria-label={`Edit ${template.name}`}><Pencil /></Button><DeleteConfirmation label={template.name} onConfirm={() => remove(template.id)} /></div></CardHeader><CardContent><div className="rounded-xl border bg-emerald-950/20 p-4"><p className="line-clamp-5 whitespace-pre-wrap break-words text-sm">{template.body || (template.type === "audio" ? "Audio tanpa caption" : "Media")}</p>{template.footer && <p className="mt-3 truncate text-xs text-muted-foreground">{template.footer}</p>}</div><p className="mt-3 text-xs text-muted-foreground">{template.is_active ? "Aktif" : "Nonaktif"} · {new Date(template.updated_at).toLocaleDateString("id-ID")}</p></CardContent></Card>)}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-[96vw] overflow-y-auto sm:max-w-4xl">
          <DialogHeader><DialogTitle>{editing ? "Edit Pesan" : "Pesan Baru"}</DialogTitle><DialogDescription>Hanya field yang didukung tipe terpilih yang akan dikirim ke KirimDev.</DialogDescription></DialogHeader>
          <form onSubmit={submit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2"><Field label="Nama internal" error={form.formState.errors.name?.message}><Input placeholder="contoh: cs_pricelist" {...form.register("name")} /></Field><Field label="Kategori internal"><Input placeholder="Customer Service" {...form.register("category")} /></Field></div>
            <Field label="Tipe pesan"><Select value={type} onValueChange={(value) => changeType(value as TemplateType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TEMPLATE_TYPES.map((item) => <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>)}</SelectContent></Select></Field>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="font-medium">{TEMPLATE_TYPE_LABELS[type]}</p><p className="mt-1 text-sm text-muted-foreground">{guide.description}</p><div className="mt-3 flex flex-wrap gap-2">{guide.fields.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}</div></div>
            <Field label="Kapan dipakai (opsional)" help="Membantu CS membedakan pesan yang isi atau tujuannya mirip."><Input placeholder="Saat customer meminta pricelist pertama kali" {...form.register("usage_context")} /></Field>

            {supportsHeader && <div className="space-y-4 rounded-xl border p-4"><Field label="Header (opsional)" help={type === "list" ? "List hanya mendukung header teks." : "Reply button dan CTA URL mendukung teks, gambar, video, atau dokumen."}><Select value={headerType} onValueChange={(value) => form.setValue("header_type", value as InteractiveHeaderType, { shouldValidate: true })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Tanpa header</SelectItem><SelectItem value="text">Teks</SelectItem>{type !== "list" && <><SelectItem value="image">Gambar</SelectItem><SelectItem value="video">Video</SelectItem><SelectItem value="document">Dokumen</SelectItem></>}</SelectContent></Select></Field>{headerType === "text" && <Field label="Teks header" error={form.formState.errors.header?.message}><Input maxLength={60} placeholder="Maksimal 60 karakter" {...form.register("header")} /></Field>}{["image", "video", "document"].includes(headerType) && <MediaUrlField type={headerType} register={form.register("media_url")} error={form.formState.errors.media_url?.message} />}</div>}

            {["image", "video", "audio", "document"].includes(type) && <MediaUrlField type={type} register={form.register("media_url")} error={form.formState.errors.media_url?.message} />}
            {type === "document" && <Field label="Nama file (opsional)" help="Contoh: pricelist-juli.pdf"><Input maxLength={255} {...form.register("filename")} /></Field>}

            {type !== "audio" && <Field label={["image", "video", "document"].includes(type) ? "Caption (opsional)" : type === "carousel" ? "Teks pengantar carousel" : "Isi pesan"} error={form.formState.errors.body?.message} help={bodyLimit ? `${body.length}/${bodyLimit} karakter` : undefined}><Textarea rows={5} maxLength={bodyLimit || undefined} placeholder={type === "text" ? "Tulis pesan customer service…" : undefined} {...form.register("body")} /></Field>}
            {type === "text" && <div className="flex items-center justify-between rounded-xl border p-4"><div><Label htmlFor="preview-url">Preview tautan</Label><p className="mt-1 text-xs text-muted-foreground">Aktifkan agar Meta mencoba menampilkan preview URL yang ada di body.</p></div><Switch id="preview-url" checked={previewUrl} onCheckedChange={(checked) => form.setValue("preview_url", checked)} /></div>}
            {supportsFooter && <Field label="Footer (opsional)" help="Maksimal 60 karakter."><Input maxLength={60} {...form.register("footer")} /></Field>}

            {type === "reply_button" && <ButtonsEditor kind="reply" fields={buttons.fields} append={() => buttons.append({ id: crypto.randomUUID(), label: "", url: "" })} remove={buttons.remove} register={form.register} />}
            {type === "url_button" && <ButtonsEditor kind="url" fields={buttons.fields} append={() => buttons.append({ id: crypto.randomUUID(), label: "", url: "" })} remove={buttons.remove} register={form.register} />}

            {type === "list" && <div className="space-y-4"><Field label="Label tombol pembuka" help="Maksimal 20 karakter."><Input maxLength={20} {...form.register("list_button_text")} /></Field><div className="flex items-center justify-between"><div><Label>Section & pilihan</Label><p className="text-xs text-muted-foreground">Maksimal 10 section; judul section/row maksimal 24 karakter.</p></div><Button type="button" size="sm" variant="outline" disabled={sections.fields.length >= 10} onClick={() => sections.append({ title: "", rows: [{ id: crypto.randomUUID(), title: "", description: "" }] })}><Plus />Section</Button></div>{sections.fields.map((section, sectionIndex) => <div key={section.id} className="space-y-3 rounded-xl border p-4"><div className="flex gap-2"><Input maxLength={24} placeholder="Judul section (opsional)" {...form.register(`sections.${sectionIndex}.title`)} /><Button type="button" variant="ghost" onClick={() => sections.remove(sectionIndex)}>Hapus</Button></div>{watchedSections[sectionIndex]?.rows?.map((row, rowIndex) => <div key={`${section.id}-${row.id}`} className="grid gap-2 rounded-lg bg-muted/40 p-3 sm:grid-cols-3"><Input maxLength={200} placeholder="ID pilihan" {...form.register(`sections.${sectionIndex}.rows.${rowIndex}.id`)} /><Input maxLength={24} placeholder="Judul" {...form.register(`sections.${sectionIndex}.rows.${rowIndex}.title`)} /><div className="flex gap-2"><Input maxLength={72} placeholder="Deskripsi" {...form.register(`sections.${sectionIndex}.rows.${rowIndex}.description`)} /><Button type="button" size="sm" variant="ghost" onClick={() => { const rows = form.getValues(`sections.${sectionIndex}.rows`); form.setValue(`sections.${sectionIndex}.rows`, rows.filter((_, index) => index !== rowIndex), { shouldValidate: true }); }}>×</Button></div></div>)}<Button type="button" size="sm" variant="outline" onClick={() => { const rows = form.getValues(`sections.${sectionIndex}.rows`) ?? []; form.setValue(`sections.${sectionIndex}.rows`, [...rows, { id: crypto.randomUUID(), title: "", description: "" }], { shouldValidate: true }); }}>Tambah pilihan</Button></div>)}{form.formState.errors.sections?.root && <p className="text-xs text-destructive">{form.formState.errors.sections.root.message}</p>}</div>}

            {type === "carousel" && <div className="space-y-4"><div className="flex items-center justify-between"><div><Label>Carousel cards</Label><p className="text-xs text-muted-foreground">Minimal 2, maksimal 10. Header card harus gambar atau video.</p></div><Button type="button" size="sm" variant="outline" disabled={carousel.fields.length >= 10} onClick={() => carousel.append(emptyCarouselCard())}><Plus />Card</Button></div>{carousel.fields.map((card, index) => { const watched = watchedCards[index]; return <div key={card.id} className="space-y-3 rounded-xl border p-4"><div className="flex items-center justify-between"><p className="font-medium">Card {index + 1}</p><Button type="button" variant="ghost" disabled={carousel.fields.length <= 2} onClick={() => carousel.remove(index)}>Hapus</Button></div><div className="grid gap-3 sm:grid-cols-2"><Field label="Media header"><Select value={watched?.header_type ?? "image"} onValueChange={(value) => form.setValue(`carousel_cards.${index}.header_type`, value as "image" | "video")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="image">Gambar</SelectItem><SelectItem value="video">Video</SelectItem></SelectContent></Select></Field><Field label="URL media"><Input type="url" placeholder="https://…" {...form.register(`carousel_cards.${index}.media_url`)} /></Field></div><Field label="Isi card (opsional)" help="Maksimal 160 karakter"><Textarea rows={2} maxLength={160} {...form.register(`carousel_cards.${index}.body`)} /></Field><div className="grid gap-3 sm:grid-cols-2"><Field label="Aksi"><Select value={watched?.action_type ?? "cta_url"} onValueChange={(value) => form.setValue(`carousel_cards.${index}.action_type`, value as "cta_url" | "quick_reply")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="cta_url">Buka URL</SelectItem><SelectItem value="quick_reply">Balasan cepat</SelectItem></SelectContent></Select></Field><Field label="Label tombol"><Input maxLength={20} {...form.register(`carousel_cards.${index}.button_label`)} /></Field></div>{watched?.action_type === "cta_url" ? <Field label="URL tombol"><Input type="url" {...form.register(`carousel_cards.${index}.button_url`)} /></Field> : <Field label="ID quick reply"><Input maxLength={256} {...form.register(`carousel_cards.${index}.button_id`)} /></Field>}</div>; })}{form.formState.errors.carousel_cards?.root && <p className="text-xs text-destructive">{form.formState.errors.carousel_cards.root.message}</p>}</div>}

            <div className="flex items-center justify-between rounded-xl border p-4"><div><Label htmlFor="template-active">Aktif</Label><p className="mt-1 text-xs text-muted-foreground">Pesan nonaktif tidak dapat dipilih Auto Reply.</p></div><Switch id="template-active" checked={active} onCheckedChange={(checked) => form.setValue("is_active", checked)} /></div>
            <a className="inline-flex items-center gap-1 text-xs text-primary hover:underline" href="https://docs.kirimdev.com/sending/send-text/" target="_blank" rel="noreferrer">Dokumentasi KirimDev <ExternalLink className="h-3 w-3" /></a>
            <DialogFooter><Button type="button" variant="outline" onClick={() => setOpen(false)}>Batal</Button><Button type="submit" disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? "Menyimpan…" : "Simpan Pesan"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, help, error, children }: { label: string; help?: string; error?: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}{help && <p className="text-xs text-muted-foreground">{help}</p>}{error && <p className="text-xs text-destructive">{error}</p>}</div>;
}

function MediaUrlField({ type, register, error }: { type: string; register: UseFormRegisterReturn; error?: string }) {
  const hint = type === "image" ? "JPEG/PNG publik, maksimal 5 MB" : type === "video" ? "MP4/3GP publik, maksimal 16 MB" : type === "document" ? "Dokumen publik, maksimal 100 MB" : "URL audio publik";
  return <Field label={`URL ${TEMPLATE_TYPE_LABELS[type as TemplateType] ?? "media"}`} help={hint} error={error}><Input type="url" placeholder="https://…" {...register} /></Field>;
}

function ButtonsEditor({ kind, fields, append, remove, register }: { kind: "reply" | "url"; fields: Array<{ id: string }>; append: () => void; remove: (index: number) => void; register: UseFormRegister<TemplateFormValues> }) {
  const max = kind === "url" ? 1 : 3;
  return <div className="space-y-3"><div className="flex items-center justify-between"><div><Label>{kind === "url" ? "Tombol CTA URL" : "Tombol balasan"}</Label><p className="text-xs text-muted-foreground">Label maksimal 20 karakter{kind === "reply" ? "; ID dikirim kembali lewat webhook" : ""}.</p></div><Button type="button" size="sm" variant="outline" disabled={fields.length >= max} onClick={append}><Plus />Tombol</Button></div>{fields.map((field, index) => <div key={field.id} className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_auto]"><Input maxLength={20} placeholder="Label tombol" {...register(`buttons.${index}.label`)} />{kind === "url" ? <Input type="url" placeholder="https://…" {...register(`buttons.${index}.url`)} /> : <Input maxLength={256} placeholder="ID tombol" {...register(`buttons.${index}.id`)} />}<Button type="button" variant="ghost" onClick={() => remove(index)}>Hapus</Button></div>)}</div>;
}
