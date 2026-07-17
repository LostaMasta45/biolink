"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowLeft, Check, CheckCheck, Clock3, MessageSquareText, Plus, RefreshCcw, Search, Send, Settings2, X } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { WhatsAppTemplate } from "@/types/whatsapp-manager";

type ConversationStatus = "open" | "pending" | "resolved";
type ConversationPriority = "low" | "normal" | "high" | "urgent";
type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";

interface InboxConversation {
  id: string;
  status: ConversationStatus;
  priority: ConversationPriority;
  unread_count: number;
  needs_reply: boolean;
  last_message_at: string | null;
  last_inbound_at: string | null;
  service_window_expires_at: string | null;
  last_message_preview: string | null;
  contact: { id: string; phone_number: string; name: string | null; profile_name: string | null } | null;
}

interface InboxMessage {
  id: string;
  direction: "inbound" | "outbound" | "system";
  body: string | null;
  message_type: string;
  status: MessageStatus;
  source: "manual_inbox" | "quick_reply" | "auto_reply" | "notification" | "flow" | "provider" | "app";
  error_message: string | null;
  created_at: string;
}

interface QuickReply {
  id: string;
  template_id: string;
  shortcut: string;
  sort_order: number;
  is_active: boolean;
  template: { id: string; name: string; body: string; is_active: boolean } | null;
}

interface InboxAccount {
  id: string;
  phone_number_id: string;
  phone_number: string | null;
  label: string;
  role: "admin" | "bot";
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Permintaan Inbox gagal");
  return payload;
}

function displayName(conversation: InboxConversation) {
  return conversation.contact?.name || conversation.contact?.profile_name || conversation.contact?.phone_number || "Customer";
}

function formatTime(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" }).format(new Date(value));
}

function isWindowOpen(conversation: InboxConversation | null) {
  return Boolean(conversation?.service_window_expires_at && new Date(conversation.service_window_expires_at).getTime() > Date.now());
}

const statusLabel: Record<MessageStatus, string> = { pending: "Menunggu", sent: "Terkirim", delivered: "Diterima", read: "Dibaca", failed: "Gagal" };

export function InboxManager() {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [accounts, setAccounts] = useState<InboxAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const [selectedQuickReplyId, setSelectedQuickReplyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [quickReplyDialog, setQuickReplyDialog] = useState(false);
  const [quickTemplateId, setQuickTemplateId] = useState("");
  const [quickShortcut, setQuickShortcut] = useState("");

  const selectedConversation = useMemo(() => conversations.find((item) => item.id === selectedId) ?? null, [conversations, selectedId]);
  const matchingQuickReplies = useMemo(() => {
    if (!draft.trimStart().startsWith("/")) return [];
    const term = draft.trimStart().slice(1).toLowerCase();
    return quickReplies.filter((item) => item.is_active && item.template?.is_active && item.shortcut.includes(term)).slice(0, 6);
  }, [draft, quickReplies]);

  const loadConversations = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const params = new URLSearchParams();
      if (selectedAccountId) params.set("account_id", selectedAccountId);
      if (filter !== "all") params.set("filter", filter);
      if (query.trim()) params.set("search", query.trim());
      const result = await api<{ data: InboxConversation[] }>(`/api/admin/whatsapp/inbox/conversations?${params.toString()}`);
      setConversations(result.data);
      setSelectedId((current) => current && result.data.some((item) => item.id === current) ? current : result.data[0]?.id ?? null);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Inbox tidak dapat dimuat"); }
    finally { if (showLoading) setLoading(false); }
  }, [filter, query, selectedAccountId]);

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const result = await api<{ data: InboxMessage[] }>(`/api/admin/whatsapp/inbox/conversations/${conversationId}/messages`);
      setMessages(result.data);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Riwayat pesan tidak dapat dimuat"); }
  }, []);

  const loadSupportData = useCallback(async () => {
    try {
      const [replyResult, templateResult, accountResult] = await Promise.all([
        api<{ data: QuickReply[] }>("/api/admin/whatsapp/inbox/quick-replies"),
        api<{ data: WhatsAppTemplate[] }>("/api/admin/whatsapp/templates"),
        api<{ data: InboxAccount[] }>("/api/admin/whatsapp/inbox/accounts"),
      ]);
      setQuickReplies(replyResult.data);
      setTemplates(templateResult.data);
      setAccounts(accountResult.data);
      setSelectedAccountId((current) => current && accountResult.data.some((account) => account.id === current) ? current : accountResult.data[0]?.id ?? "");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Balas Cepat tidak dapat dimuat"); }
  }, []);

  useEffect(() => { void Promise.all([loadConversations(true), loadSupportData()]); }, [loadConversations, loadSupportData]);
  useEffect(() => { if (selectedId) void loadMessages(selectedId); else setMessages([]); }, [loadMessages, selectedId]);
  useEffect(() => {
    const interval = window.setInterval(() => { void loadConversations(); if (selectedId) void loadMessages(selectedId); }, 5_000);
    return () => window.clearInterval(interval);
  }, [loadConversations, loadMessages, selectedId]);

  const selectConversation = async (conversation: InboxConversation) => {
    setSelectedId(conversation.id);
    if (conversation.unread_count > 0) {
      try {
        await api(`/api/admin/whatsapp/inbox/conversations/${conversation.id}`, { method: "PATCH", body: JSON.stringify({ markRead: true }) });
        setConversations((items) => items.map((item) => item.id === conversation.id ? { ...item, unread_count: 0 } : item));
      } catch { /* Pesan tetap dapat dibaca walau counter gagal diubah. */ }
    }
  };

  const send = async () => {
    if (!selectedConversation || !draft.trim() || sending) return;
    if (!isWindowOpen(selectedConversation)) { toast.error("Jendela layanan 24 jam telah berakhir. Pesan teks tidak boleh dikirim."); return; }
    const body = draft.trim();
    const requestId = crypto.randomUUID();
    const optimistic: InboxMessage = { id: `optimistic-${requestId}`, direction: "outbound", body, message_type: "text", status: "pending", source: selectedQuickReplyId ? "quick_reply" : "manual_inbox", error_message: null, created_at: new Date().toISOString() };
    setMessages((items) => [...items, optimistic]);
    setDraft("");
    setSelectedQuickReplyId(null);
    setSending(true);
    try {
      const result = await api<{ data: InboxMessage }>(`/api/admin/whatsapp/inbox/conversations/${selectedConversation.id}/messages`, { method: "POST", body: JSON.stringify({ body, clientRequestId: requestId, quickReplyId: selectedQuickReplyId }) });
      setMessages((items) => items.map((item) => item.id === optimistic.id ? result.data : item));
      await loadConversations();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pesan tidak dapat dikirim";
      setMessages((items) => items.map((item) => item.id === optimistic.id ? { ...item, status: "failed", error_message: message } : item));
      toast.error(message);
    } finally { setSending(false); }
  };

  const setConversationField = async (patch: Record<string, string>) => {
    if (!selectedConversation) return;
    try {
      const result = await api<{ data: InboxConversation }>(`/api/admin/whatsapp/inbox/conversations/${selectedConversation.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      setConversations((items) => items.map((item) => item.id === selectedConversation.id ? { ...item, ...result.data } : item));
    } catch (error) { toast.error(error instanceof Error ? error.message : "Percakapan tidak dapat diperbarui"); }
  };

  const applyQuickReply = (reply: QuickReply) => {
    if (!reply.template) return;
    setDraft(reply.template.body);
    setSelectedQuickReplyId(reply.id);
  };

  const createQuickReply = async () => {
    if (!quickTemplateId || !quickShortcut.trim()) return toast.error("Pilih Pesan Tersimpan dan isi shortcut");
    try {
      await api("/api/admin/whatsapp/inbox/quick-replies", { method: "POST", body: JSON.stringify({ templateId: quickTemplateId, shortcut: quickShortcut }) });
      setQuickTemplateId(""); setQuickShortcut("");
      await loadSupportData();
      toast.success("Balas Cepat dibuat");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Balas Cepat tidak dapat dibuat"); }
  };

  const toggleQuickReply = async (reply: QuickReply) => {
    try {
      await api(`/api/admin/whatsapp/inbox/quick-replies/${reply.id}`, { method: "PATCH", body: JSON.stringify({ shortcut: reply.shortcut, sortOrder: reply.sort_order, isActive: !reply.is_active }) });
      await loadSupportData();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Status Balas Cepat tidak dapat diubah"); }
  };

  const deleteQuickReply = async (reply: QuickReply) => {
    try { await api(`/api/admin/whatsapp/inbox/quick-replies/${reply.id}`, { method: "DELETE" }); await loadSupportData(); toast.success("Balas Cepat dihapus"); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Balas Cepat tidak dapat dihapus"); }
  };

  const syncMessages = async () => {
    if (!selectedAccountId) return toast.error("Pilih akun Inbox terlebih dahulu");
    try {
      const result = await api<{ message: string }>("/api/admin/whatsapp/inbox/sync", { method: "POST", body: JSON.stringify({ accountId: selectedAccountId, resource: "messages" }) });
      toast.success(result.message);
      await loadConversations();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Sync chat gagal"); }
  };

  return <div className="space-y-5">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-2xl font-bold tracking-tight">WhatsApp Inbox</h2><p className="text-sm text-muted-foreground">Pilih Admin Utama atau Bot. Ketik <b>/</b> untuk memakai Balas Cepat tanpa memicu automation.</p></div><div className="flex flex-wrap gap-2"><Select value={selectedAccountId} onValueChange={setSelectedAccountId}><SelectTrigger className="w-[190px]"><SelectValue placeholder="Pilih akun" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.label}</SelectItem>)}</SelectContent></Select><Button variant="outline" onClick={() => void syncMessages()} disabled={!selectedAccountId}><RefreshCcw />Sync chat</Button><Button variant="outline" onClick={() => void loadConversations(true)}><RefreshCcw />Muat ulang</Button><Button onClick={() => setQuickReplyDialog(true)}><Settings2 />Balas Cepat</Button></div></div>
    <Card className="overflow-hidden"><CardContent className="p-0"><div className="grid min-h-[680px] lg:grid-cols-[340px_minmax(0,1fr)]"><aside className={`border-r ${selectedConversation ? "hidden lg:block" : "block"}`}><div className="space-y-3 border-b p-3"><div className="relative"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari nama atau nomor" className="pl-9" /></div><Select value={filter} onValueChange={setFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua percakapan</SelectItem><SelectItem value="unread">Belum dibaca</SelectItem><SelectItem value="needs_reply">Perlu dibalas</SelectItem></SelectContent></Select></div><div className="max-h-[590px] overflow-y-auto">{loading ? <p className="p-5 text-sm text-muted-foreground">Memuat percakapan…</p> : conversations.length === 0 ? <p className="p-5 text-sm text-muted-foreground">Belum ada chat customer. Pesan baru akan muncul otomatis setelah webhook diterima.</p> : conversations.map((conversation) => <button key={conversation.id} type="button" onClick={() => void selectConversation(conversation)} className={`w-full border-b p-4 text-left transition-colors hover:bg-muted/60 ${selectedId === conversation.id ? "bg-muted" : ""}`}><div className="flex items-center justify-between gap-2"><b className="truncate">{displayName(conversation)}</b><span className="shrink-0 text-[11px] text-muted-foreground">{formatTime(conversation.last_message_at)}</span></div><div className="mt-1 flex items-center gap-2"><span className="truncate text-sm text-muted-foreground">{conversation.last_message_preview || "Belum ada pesan"}</span>{conversation.unread_count > 0 && <Badge className="ml-auto rounded-full px-2">{conversation.unread_count}</Badge>}</div><div className="mt-2 flex gap-1">{conversation.needs_reply && <Badge variant="outline" className="text-[10px]">Perlu balas</Badge>}<Badge variant="secondary" className="text-[10px]">{conversation.priority}</Badge></div></button>)}</div></aside><section className={`${selectedConversation ? "flex" : "hidden lg:flex"} min-w-0 flex-col`}>{selectedConversation ? <><header className="flex flex-wrap items-center gap-2 border-b p-4"><Button className="lg:hidden" size="icon" variant="ghost" onClick={() => setSelectedId(null)}><ArrowLeft /></Button><div className="min-w-[160px] flex-1"><h3 className="font-semibold">{displayName(selectedConversation)}</h3><p className="text-xs text-muted-foreground">{selectedConversation.contact?.phone_number}</p></div><Badge variant={isWindowOpen(selectedConversation) ? "default" : "destructive"} className="gap-1"><Clock3 className="h-3 w-3" />{isWindowOpen(selectedConversation) ? "24 jam aktif" : "24 jam berakhir"}</Badge><Select value={selectedConversation.status} onValueChange={(status) => void setConversationField({ status })}><SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="open">Open</SelectItem><SelectItem value="pending">Pending</SelectItem><SelectItem value="resolved">Resolved</SelectItem></SelectContent></Select><Select value={selectedConversation.priority} onValueChange={(priority) => void setConversationField({ priority })}><SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="low">Low</SelectItem><SelectItem value="normal">Normal</SelectItem><SelectItem value="high">High</SelectItem><SelectItem value="urgent">Urgent</SelectItem></SelectContent></Select></header><div className="flex-1 space-y-3 overflow-y-auto bg-muted/20 p-4">{messages.length === 0 ? <p className="text-center text-sm text-muted-foreground">Riwayat pesan belum tersedia.</p> : messages.map((message) => <div key={message.id} className={`flex ${message.direction === "outbound" ? "justify-end" : "justify-start"}`}><div className={`max-w-[86%] rounded-2xl px-3 py-2 text-sm shadow-sm ${message.direction === "outbound" ? "bg-primary text-primary-foreground" : "bg-card"}`}><p className="whitespace-pre-wrap">{message.body || `[${message.message_type}]`}</p><div className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${message.direction === "outbound" ? "text-primary-foreground/75" : "text-muted-foreground"}`}><span>{formatTime(message.created_at)}</span>{message.direction === "outbound" && <MessageStatus status={message.status} />}</div>{message.source !== "provider" && <span className={`mt-1 block text-[10px] ${message.direction === "outbound" ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{message.source === "quick_reply" ? "Balas Cepat" : message.source === "manual_inbox" ? "Manual" : message.source}</span>}{message.error_message && <p className="mt-1 text-xs text-destructive">{message.error_message}</p>}</div></div>)}</div><div className="border-t bg-card p-3"><div className="relative"><Textarea value={draft} onChange={(event) => { setDraft(event.target.value); if (!event.target.value.trimStart().startsWith("/")) setSelectedQuickReplyId(null); }} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} disabled={sending || !isWindowOpen(selectedConversation)} placeholder={isWindowOpen(selectedConversation) ? "Tulis pesan, atau ketik / untuk Balas Cepat" : "Jendela 24 jam telah berakhir"} className="min-h-24 resize-none pr-14" />{matchingQuickReplies.length > 0 && <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border bg-popover shadow-lg">{matchingQuickReplies.map((reply) => <button key={reply.id} type="button" onClick={() => applyQuickReply(reply)} className="block w-full border-b px-3 py-2 text-left last:border-0 hover:bg-muted"><span className="font-medium">/{reply.shortcut}</span><span className="ml-2 text-xs text-muted-foreground">{reply.template?.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{reply.template?.body}</span></button>)}</div>}</div><div className="mt-2 flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">{selectedQuickReplyId ? "Pesan dari Balas Cepat; tetap bisa diedit sebelum dikirim." : "Enter kirim · Shift+Enter baris baru"}</span><Button onClick={() => void send()} disabled={!draft.trim() || sending || !isWindowOpen(selectedConversation)}>{sending ? "Mengirim…" : <><Send />Kirim</>}</Button></div></div></> : <div className="m-auto max-w-sm text-center"><MessageSquareText className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><h3 className="font-semibold">Pilih percakapan</h3><p className="mt-1 text-sm text-muted-foreground">Pilih chat di daftar untuk membalas customer.</p></div>}</section></div></CardContent></Card>

    <Dialog open={quickReplyDialog} onOpenChange={setQuickReplyDialog}><DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>Balas Cepat</DialogTitle><DialogDescription>Shortcut hanya memasukkan isi Pesan Tersimpan ke draft chat. Tidak pernah memicu Auto Reply atau Flow Map.</DialogDescription></DialogHeader><div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_180px_auto]"><div className="space-y-2"><Label>Pesan Tersimpan</Label><Select value={quickTemplateId} onValueChange={setQuickTemplateId}><SelectTrigger><SelectValue placeholder="Pilih pesan" /></SelectTrigger><SelectContent>{templates.filter((template) => template.is_active && template.type === "text").map((template) => <SelectItem key={template.id} value={template.id}>{template.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Shortcut</Label><Input value={quickShortcut} onChange={(event) => setQuickShortcut(event.target.value)} placeholder="chat" /></div><Button className="self-end" onClick={() => void createQuickReply()}><Plus />Tambah</Button></div><div className="space-y-2">{quickReplies.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">Belum ada Balas Cepat. Buat dari Pesan Tersimpan di atas.</p> : quickReplies.map((reply) => <div key={reply.id} className="flex items-center gap-3 rounded-lg border p-3"><div className="min-w-0 flex-1"><b>/{reply.shortcut}</b><span className="ml-2 text-sm text-muted-foreground">{reply.template?.name ?? "Pesan sudah dihapus"}</span><p className="truncate text-xs text-muted-foreground">{reply.template?.body}</p></div><Switch checked={reply.is_active} onCheckedChange={() => void toggleQuickReply(reply)} /><Button size="icon" variant="ghost" aria-label={`Hapus /${reply.shortcut}`} onClick={() => void deleteQuickReply(reply)}><X className="text-destructive" /></Button></div>)}</div><DialogFooter><Button variant="outline" onClick={() => setQuickReplyDialog(false)}>Selesai</Button></DialogFooter></DialogContent></Dialog>
  </div>;
}

function MessageStatus({ status }: { status: MessageStatus }) {
  if (status === "failed") return <span title={statusLabel[status]}><AlertCircle className="h-3.5 w-3.5" /></span>;
  if (status === "read") return <span title={statusLabel[status]}><CheckCheck className="h-3.5 w-3.5" /></span>;
  if (status === "delivered") return <span title={statusLabel[status]}><CheckCheck className="h-3.5 w-3.5" /></span>;
  if (status === "sent") return <span title={statusLabel[status]}><Check className="h-3.5 w-3.5" /></span>;
  return <span title={statusLabel[status]}><Clock3 className="h-3.5 w-3.5" /></span>;
}
