"use client";

import { useMemo, useState } from "react";
import { Bot, Pencil } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PageHeading } from "@/components/whatsapp/page-heading";
import { EmptyState, ResourceError, ResourceLoading } from "@/components/whatsapp/resource-state";
import { useManagerResource } from "@/hooks/use-manager-resource";
import { updateManagerResource } from "@/services/whatsapp-manager-client";
import type { BotCommandConfig } from "@/types/whatsapp-manager";

export function BotCommandManager() {
  const commands = useManagerResource<BotCommandConfig>("bot_commands");
  const [editing, setEditing] = useState<BotCommandConfig | null>(null);
  const [draft, setDraft] = useState<BotCommandConfig | null>(null);
  const grouped = useMemo(() => commands.data.reduce<Record<string, BotCommandConfig[]>>((all, item) => ({ ...all, [item.category]: [...(all[item.category] ?? []), item] }), {}), [commands.data]);
  if (commands.loading) return <ResourceLoading />;
  if (commands.error) return <ResourceError message={`${commands.error}. Jalankan migration Notification Center terlebih dahulu.`} />;

  const save = async () => {
    if (!draft) return;
    try { await updateManagerResource("bot_commands", draft.id, draft); toast.success("Command diperbarui"); setEditing(null); setDraft(null); await commands.refresh(); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menyimpan command"); }
  };

  return <div className="space-y-6"><PageHeading title="Bot Commands" description="Menu internal yang hanya menerima pesan dari Admin Utama ke nomor Bot." icon={Bot} />
    <Card className="border-primary/20 bg-primary/5"><CardContent className="p-4 text-sm"><p className="font-medium">Keamanan command aktif</p><p className="mt-1 text-muted-foreground">Customer yang menghubungi Bot diabaikan. Command dari Admin Utama ke nomor selain Bot juga tidak dijalankan. Handler tetap berada di kode; dashboard mengatur status, alias, nama, urutan, dan visibilitas menu.</p></CardContent></Card>
    {commands.data.length === 0 ? <EmptyState title="Command belum disiapkan" description="Jalankan migration untuk memasukkan command bawaan." /> : Object.entries(grouped).map(([category, items]) => <Card key={category}><CardHeader><CardTitle className="text-base">{category}</CardTitle></CardHeader><CardContent className="space-y-2">{items.map((item) => <div key={item.id} className="flex flex-col justify-between gap-3 rounded-xl border p-4 sm:flex-row sm:items-center"><div><div className="flex flex-wrap items-center gap-2"><code className="font-semibold text-primary">{item.command}</code>{item.aliases.map((alias) => <Badge key={alias} variant="secondary">{alias}</Badge>)}{!item.show_in_menu && <Badge variant="outline">Disembunyikan</Badge>}{!item.is_active && <Badge variant="destructive">Nonaktif</Badge>}</div><p className="mt-1 text-sm">{item.description}</p><p className="text-xs text-muted-foreground">Contoh: {item.usage} · handler: {item.handler_key}</p></div><Button size="icon" variant="ghost" onClick={() => { setEditing(item); setDraft({ ...item }); }}><Pencil /></Button></div>)}</CardContent></Card>)}
    <Dialog open={Boolean(editing)} onOpenChange={(value) => { if (!value) { setEditing(null); setDraft(null); } }}><DialogContent><DialogHeader><DialogTitle>Edit {draft?.command}</DialogTitle><DialogDescription>Nama handler tidak dapat diubah dari dashboard agar command tidak menunjuk fungsi yang tidak tersedia.</DialogDescription></DialogHeader>{draft && <div className="space-y-4"><Field label="Deskripsi"><Textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field><Field label="Cara penggunaan"><Input value={draft.usage} onChange={(e) => setDraft({ ...draft, usage: e.target.value })} /></Field><Field label="Kategori"><Input value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></Field><Field label="Alias (pisahkan koma)"><Input value={draft.aliases.join(", ")} onChange={(e) => setDraft({ ...draft, aliases: e.target.value.split(",").map((v) => v.trim().toLowerCase()).filter(Boolean) })} /></Field><Field label="Urutan"><Input type="number" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Number(e.target.value) })} /></Field><Toggle label="Command aktif" checked={draft.is_active} onChange={(checked) => setDraft({ ...draft, is_active: checked })} /><Toggle label="Tampilkan pada !menu" checked={draft.show_in_menu} onChange={(checked) => setDraft({ ...draft, show_in_menu: checked })} /></div>}<DialogFooter><Button variant="outline" onClick={() => setEditing(null)}>Batal</Button><Button onClick={save}>Simpan</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><Label>{label}</Label>{children}</div>; }
function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) { return <div className="flex items-center justify-between rounded-xl border p-3"><Label>{label}</Label><Switch checked={checked} onCheckedChange={onChange} /></div>; }
