"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCheck,
  Clock3,
  ContactRound,
  LoaderCircle,
  MessageSquareText,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Settings2,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { describeServiceWindow, formatServiceWindowDuration, getServiceWindowStatus } from "@/lib/whatsapp/service-window";
import type { WhatsAppTemplate } from "@/types/whatsapp-manager";

type ConversationStatus = "open" | "pending" | "resolved";
type ConversationPriority = "low" | "normal" | "high" | "urgent";
type MessageStatus = "pending" | "sent" | "delivered" | "read" | "failed";
type SyncResource = "conversations" | "contacts" | "messages";

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
  contact: {
    id: string;
    phone_number: string;
    name: string | null;
    profile_name: string | null;
  } | null;
}
interface InboxMessage {
  id: string;
  direction: "inbound" | "outbound" | "system";
  body: string | null;
  message_type: string;
  media_url: string | null;
  media_mime_type: string | null;
  media_filename: string | null;
  status: MessageStatus;
  source:
    | "manual_inbox"
    | "quick_reply"
    | "auto_reply"
    | "notification"
    | "flow"
    | "provider"
    | "app";
  error_message: string | null;
  created_at: string;
}
interface QuickReply {
  id: string;
  template_id: string;
  shortcut: string;
  sort_order: number;
  is_active: boolean;
  template: {
    id: string;
    name: string;
    body: string;
    is_active: boolean;
  } | null;
}
interface AutoReplyShortcut {
  id: string;
  keyword: string;
  flow_id: string | null;
  priority: number;
  is_active: boolean;
  inbox_quick_reply_enabled: boolean;
  template: {
    id: string;
    name: string;
    body: string;
    type: WhatsAppTemplate["type"];
    is_active: boolean;
  } | null;
}
interface InboxReplySuggestion {
  id: string;
  shortcut: string;
  body: string;
  label: string;
  source: "quick_reply" | "auto_reply";
}
interface InboxAccount {
  id: string;
  phone_number_id: string;
  phone_number: string | null;
  label: string;
  role: "admin" | "bot";
}
interface SyncResult {
  processed: number;
  hasMore: boolean;
  completed: boolean;
  message: string;
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Permintaan Inbox gagal");
  return payload;
}

function displayName(conversation: InboxConversation) {
  return (
    conversation.contact?.name ||
    conversation.contact?.profile_name ||
    conversation.contact?.phone_number ||
    "Customer"
  );
}
function formatTime(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        day: "numeric",
        month: "short",
      }).format(new Date(value))
    : "";
}
function isWindowOpen(conversation: InboxConversation | null) {
  return getServiceWindowStatus(conversation?.last_inbound_at).state === "active";
}
function serviceWindowLabel(conversation: InboxConversation | null) {
  const window = getServiceWindowStatus(conversation?.last_inbound_at);
  if (window.state === "active") return `Aktif · sisa ${formatServiceWindowDuration(window.remainingMs)}`;
  if (window.state === "missing") return "Menunggu chat customer";
  if (window.state === "invalid") return "Waktu chat tidak valid";
  return "24 jam berakhir";
}
const statusLabel: Record<MessageStatus, string> = {
  pending: "Menunggu",
  sent: "Terkirim",
  delivered: "Diterima",
  read: "Dibaca",
  failed: "Gagal",
};

function isMediaMessage(message: InboxMessage) {
  return ["image", "video", "audio", "document", "sticker"].includes(
    message.message_type
  );
}

function InboxMediaPreview({ message }: { message: InboxMessage }) {
  if (!isMediaMessage(message) || message.id.startsWith("optimistic-"))
    return null;
  const source = `/api/admin/whatsapp/inbox/messages/${message.id}/media`;
  if (message.message_type === "image" || message.message_type === "sticker") {
    return (
      // The authenticated media route cannot be optimized by Next's server image loader.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={source}
        alt={message.body || "Media WhatsApp"}
        className="mb-2 max-h-72 max-w-full rounded-md object-contain"
      />
    );
  }
  if (message.message_type === "video") {
    return (
      <video
        controls
        preload="metadata"
        src={source}
        className="mb-2 max-h-72 max-w-full rounded-md"
      />
    );
  }
  if (message.message_type === "audio") {
    return (
      <audio
        controls
        preload="metadata"
        src={source}
        className="mb-2 max-w-full"
      />
    );
  }
  return (
    <a
      href={source}
      target="_blank"
      rel="noreferrer"
      className="mb-2 block rounded-md border border-current/20 px-3 py-2 text-xs font-medium underline"
    >
      {message.media_filename || "Buka dokumen"}
    </a>
  );
}

function hideProviderEchoDuplicates(messages: InboxMessage[]) {
  return messages.filter((message) => {
    if (
      message.direction !== "outbound" ||
      message.source !== "app" ||
      !message.body
    )
      return true;
    const echoedAt = new Date(message.created_at).getTime();
    return !messages.some(
      (candidate) =>
        candidate.id !== message.id &&
        candidate.direction === "outbound" &&
        ["manual_inbox", "quick_reply"].includes(candidate.source) &&
        candidate.message_type === message.message_type &&
        candidate.body === message.body &&
        Math.abs(new Date(candidate.created_at).getTime() - echoedAt) <
          5 * 60_000
    );
  });
}

export function InboxManager() {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [quickReplies, setQuickReplies] = useState<QuickReply[]>([]);
  const [autoReplyShortcuts, setAutoReplyShortcuts] = useState<
    AutoReplyShortcut[]
  >([]);
  const [accounts, setAccounts] = useState<InboxAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [draft, setDraft] = useState("");
  const [selectedQuickReplyId, setSelectedQuickReplyId] = useState<
    string | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [quickReplyDialog, setQuickReplyDialog] = useState(false);
  const [quickTemplateId, setQuickTemplateId] = useState("");
  const [quickShortcut, setQuickShortcut] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView();
  }, [messages]);

  const selectedConversation = useMemo(
    () => conversations.find((item) => item.id === selectedId) ?? null,
    [conversations, selectedId]
  );
  const matchingReplies = useMemo<InboxReplySuggestion[]>(() => {
    if (!draft.trimStart().startsWith("/")) return [];
    const query = draft.trimStart().slice(1).toLocaleLowerCase("id-ID");
    const automationReplies = autoReplyShortcuts
      .filter(
        (rule) =>
          rule.is_active &&
          rule.inbox_quick_reply_enabled &&
          !rule.flow_id &&
          rule.template?.is_active &&
          rule.template.type === "text"
      )
      .map((rule) => ({
        id: rule.id,
        shortcut: rule.keyword,
        body: rule.template?.body ?? "",
        label: `Keyword Automation · ${
          rule.template?.name ?? "Pesan Tersimpan"
        }`,
        source: "auto_reply" as const,
      }))
      .filter((reply) => reply.body && reply.shortcut.includes(query));
    const savedReplies = quickReplies
      .filter((reply) => reply.is_active && reply.template?.is_active)
      .map((reply) => ({
        id: reply.id,
        shortcut: reply.shortcut,
        body: reply.template?.body ?? "",
        label: reply.template?.name ?? "Pesan Tersimpan",
        source: "quick_reply" as const,
      }))
      .filter((reply) => reply.body && reply.shortcut.includes(query));
    return [...automationReplies, ...savedReplies].slice(0, 6);
  }, [autoReplyShortcuts, draft, quickReplies]);

  const loadConversations = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedAccountId) params.set("account_id", selectedAccountId);
        if (filter !== "all") params.set("filter", filter);
        if (query.trim()) params.set("search", query.trim());
        const result = await api<{ data: InboxConversation[] }>(
          `/api/admin/whatsapp/inbox/conversations?${params}`
        );
        setConversations(result.data);
        setSelectedId((current) =>
          current && result.data.some((item) => item.id === current)
            ? current
            : result.data[0]?.id ?? null
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Inbox tidak dapat dimuat"
        );
      } finally {
        if (showLoading) setLoading(false);
      }
    },
    [filter, query, selectedAccountId]
  );

  const loadMessages = useCallback(async (conversationId: string) => {
    try {
      const result = await api<{ data: InboxMessage[] }>(
        `/api/admin/whatsapp/inbox/conversations/${conversationId}/messages`
      );
      setMessages(hideProviderEchoDuplicates(result.data));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Riwayat pesan tidak dapat dimuat"
      );
    }
  }, []);

  const loadSupportData = useCallback(async () => {
    try {
      const [replyResult, templateResult, accountResult, autoReplyResult] =
        await Promise.all([
          api<{ data: QuickReply[] }>(
            "/api/admin/whatsapp/inbox/quick-replies"
          ),
          api<{ data: WhatsAppTemplate[] }>("/api/admin/whatsapp/templates"),
          api<{ data: InboxAccount[] }>("/api/admin/whatsapp/inbox/accounts"),
          api<{ data: AutoReplyShortcut[] }>("/api/admin/whatsapp/auto_reply"),
        ]);
      setQuickReplies(replyResult.data);
      setTemplates(templateResult.data);
      setAccounts(accountResult.data);
      setAutoReplyShortcuts(autoReplyResult.data);
      setSelectedAccountId((current) =>
        current && accountResult.data.some((account) => account.id === current)
          ? current
          : accountResult.data[0]?.id ?? ""
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Data Inbox tidak dapat dimuat"
      );
    }
  }, []);

  useEffect(() => {
    void Promise.all([loadConversations(true), loadSupportData()]);
  }, [loadConversations, loadSupportData]);
  useEffect(() => {
    if (selectedId) void loadMessages(selectedId);
    else setMessages([]);
  }, [loadMessages, selectedId]);
  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadConversations();
      if (selectedId) void loadMessages(selectedId);
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [loadConversations, loadMessages, selectedId]);

  const selectConversation = async (conversation: InboxConversation) => {
    setSelectedId(conversation.id);
    if (!conversation.unread_count) return;
    try {
      await api(`/api/admin/whatsapp/inbox/conversations/${conversation.id}`, {
        method: "PATCH",
        body: JSON.stringify({ markRead: true }),
      });
      setConversations((items) =>
        items.map((item) =>
          item.id === conversation.id ? { ...item, unread_count: 0 } : item
        )
      );
    } catch {
      /* Counter is non-blocking. */
    }
  };

  const syncEverything = async () => {
    if (!selectedAccountId || syncing) return;
    setSyncing(true);
    let total = 0;
    try {
      for (const resource of [
        "conversations",
        "contacts",
        "messages",
      ] as SyncResource[]) {
        let hasMore = true;
        let page = 0;
        while (hasMore) {
          page += 1;
          setSyncProgress(
            `${
              resource === "conversations"
                ? "Daftar chat"
                : resource === "contacts"
                ? "Kontak"
                : "Riwayat pesan"
            }: batch ${page} · ${total} data tersimpan`
          );
          const result = await api<SyncResult>(
            "/api/admin/whatsapp/inbox/sync",
            {
              method: "POST",
              body: JSON.stringify({ accountId: selectedAccountId, resource }),
            }
          );
          total += result.processed;
          hasMore = result.hasMore;
          if (resource !== "contacts") await loadConversations();
        }
      }
      setSyncProgress(`Sinkronisasi lengkap · ${total} data diperbarui`);
      toast.success("Chat, riwayat pesan, dan kontak telah tersinkron");
      await loadConversations(true);
    } catch (error) {
      setSyncProgress("Sinkronisasi berhenti");
      toast.error(error instanceof Error ? error.message : "Sync Inbox gagal");
    } finally {
      setSyncing(false);
    }
  };

  const send = async () => {
    if (!selectedConversation || !draft.trim() || sending) return;
    if (!isWindowOpen(selectedConversation))
      return toast.error(
        "Jendela layanan 24 jam telah berakhir. Pesan teks tidak boleh dikirim."
      );
    const body = draft.trim();
    const requestId = crypto.randomUUID();
    const quickReplyId = selectedQuickReplyId;
    const optimistic: InboxMessage = {
      id: `optimistic-${requestId}`,
      direction: "outbound",
      body,
      message_type: "text",
      media_url: null,
      media_mime_type: null,
      media_filename: null,
      status: "pending",
      source: quickReplyId ? "quick_reply" : "manual_inbox",
      error_message: null,
      created_at: new Date().toISOString(),
    };
    setMessages((items) => [...items, optimistic]);
    setDraft("");
    setSelectedQuickReplyId(null);
    setSending(true);
    try {
      const result = await api<{ data: InboxMessage }>(
        `/api/admin/whatsapp/inbox/conversations/${selectedConversation.id}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            body,
            clientRequestId: requestId,
            quickReplyId,
          }),
        }
      );
      setMessages((items) =>
        items.map((item) => (item.id === optimistic.id ? result.data : item))
      );
      await loadConversations();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Pesan tidak dapat dikirim";
      setMessages((items) =>
        items.map((item) =>
          item.id === optimistic.id
            ? { ...item, status: "failed", error_message: message }
            : item
        )
      );
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const setConversationField = async (patch: Record<string, string>) => {
    if (!selectedConversation) return;
    try {
      const result = await api<{ data: InboxConversation }>(
        `/api/admin/whatsapp/inbox/conversations/${selectedConversation.id}`,
        { method: "PATCH", body: JSON.stringify(patch) }
      );
      setConversations((items) =>
        items.map((item) =>
          item.id === selectedConversation.id
            ? { ...item, ...result.data }
            : item
        )
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Percakapan tidak dapat diperbarui"
      );
    }
  };

  const createQuickReply = async () => {
    if (!quickTemplateId || !quickShortcut.trim())
      return toast.error("Pilih Pesan Tersimpan dan isi shortcut");
    try {
      await api("/api/admin/whatsapp/inbox/quick-replies", {
        method: "POST",
        body: JSON.stringify({
          templateId: quickTemplateId,
          shortcut: quickShortcut,
        }),
      });
      setQuickTemplateId("");
      setQuickShortcut("");
      await loadSupportData();
      toast.success("Balas Cepat dibuat");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Balas Cepat tidak dapat dibuat"
      );
    }
  };
  const toggleQuickReply = async (reply: QuickReply) => {
    try {
      await api(`/api/admin/whatsapp/inbox/quick-replies/${reply.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          shortcut: reply.shortcut,
          sortOrder: reply.sort_order,
          isActive: !reply.is_active,
        }),
      });
      await loadSupportData();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Status Balas Cepat tidak dapat diubah"
      );
    }
  };
  const deleteQuickReply = async (reply: QuickReply) => {
    try {
      await api(`/api/admin/whatsapp/inbox/quick-replies/${reply.id}`, {
        method: "DELETE",
      });
      await loadSupportData();
      toast.success("Balas Cepat dihapus");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Balas Cepat tidak dapat dihapus"
      );
    }
  };

  return (
    <div className="inbox-workspace space-y-4 overflow-hidden">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inbox</h1>
          <p className="text-sm text-muted-foreground">
            Ruang kerja customer service · data lokal tersinkron dari KirimDev
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select
            value={selectedAccountId}
            onValueChange={setSelectedAccountId}
          >
            <SelectTrigger className="w-[190px]">
              <SelectValue placeholder="Pilih akun" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" asChild>
            <Link href="/admin/inbox/contacts">
              <ContactRound />
              Kontak
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={() => void loadConversations(true)}
          >
            <RefreshCcw />
            Muat ulang
          </Button>
          <Button
            onClick={() => void syncEverything()}
            disabled={!selectedAccountId || syncing}
          >
            {syncing ? (
              <LoaderCircle className="animate-spin" />
            ) : (
              <RefreshCcw />
            )}
            {syncing ? "Menyinkronkan…" : "Sync semua"}
          </Button>
        </div>
      </div>
      {syncProgress && (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
          {syncProgress}
        </p>
      )}
      <div className="h-[calc(100dvh-14rem)] min-h-[470px] overflow-hidden rounded-2xl border bg-[#efeae2] shadow-sm dark:bg-[#0b141a]">
        <div className="grid h-full min-h-0 lg:grid-cols-[340px_minmax(0,1fr)]">
          <aside
            className={`border-r bg-background ${
              selectedConversation ? "hidden lg:block" : "block"
            }`}
          >
            <div className="border-b bg-[#f0f2f5] p-3 dark:bg-[#202c33]">
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                    ILJ
                  </div>
                  <div>
                    <p className="text-sm font-semibold">WhatsApp</p>
                    <p className="text-[11px] text-muted-foreground">
                      {accounts.find(
                        (account) => account.id === selectedAccountId
                      )?.label ?? "Memuat akun…"}
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setQuickReplyDialog(true)}
                  aria-label="Balas Cepat"
                >
                  <Settings2 className="h-4 w-4" />
                </Button>
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari atau mulai chat baru"
                  className="bg-background pl-9"
                />
              </div>
            </div>
            <div className="border-b p-2">
              <Select value={filter} onValueChange={setFilter}>
                <SelectTrigger className="h-8 border-0 bg-transparent text-xs shadow-none">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua percakapan</SelectItem>
                  <SelectItem value="unread">Belum dibaca</SelectItem>
                  <SelectItem value="needs_reply">Perlu dibalas</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="max-h-[calc(100dvh-21rem)] overflow-y-auto lg:max-h-[calc(100dvh-17rem)]">
              {loading ? (
                <p className="p-6 text-center text-sm text-muted-foreground">
                  Memuat percakapan…
                </p>
              ) : conversations.length === 0 ? (
                <div className="p-8 text-center">
                  <MessageSquareText className="mx-auto mb-3 h-9 w-9 text-muted-foreground" />
                  <p className="font-medium">Belum ada chat lokal</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Tekan Sync semua untuk memuat chat dan kontak dari KirimDev.
                  </p>
                </div>
              ) : (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => void selectConversation(conversation)}
                    className={`flex w-full gap-3 border-b px-3 py-3 text-left transition-colors hover:bg-muted/70 ${
                      selectedId === conversation.id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted text-sm font-semibold">
                      {displayName(conversation).slice(0, 1).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <b className="truncate text-sm">
                          {displayName(conversation)}
                        </b>
                        <span className="shrink-0 text-[10px] text-muted-foreground">
                          {formatTime(conversation.last_message_at)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="truncate text-xs text-muted-foreground">
                          {conversation.last_message_preview ||
                            "Riwayat sedang disinkronkan"}
                        </span>
                        {conversation.unread_count > 0 && (
                          <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-emerald-600 px-1 text-[10px] font-semibold text-white">
                            {conversation.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>
          <section
            className={`${
              selectedConversation ? "flex" : "hidden lg:flex"
            } min-w-0 flex-col`}
          >
            <>
              {selectedConversation ? (
                <>
                  <header className="flex min-h-16 flex-wrap items-center gap-2 border-b bg-[#f0f2f5] px-3 py-2 dark:bg-[#202c33]">
                    <Button
                      className="lg:hidden"
                      size="icon"
                      variant="ghost"
                      onClick={() => setSelectedId(null)}
                    >
                      <ArrowLeft />
                    </Button>
                    <div className="grid h-10 w-10 place-items-center rounded-full bg-muted font-semibold">
                      {displayName(selectedConversation)
                        .slice(0, 1)
                        .toUpperCase()}
                    </div>
                    <div className="min-w-[130px] flex-1">
                      <h2 className="font-semibold">
                        {displayName(selectedConversation)}
                      </h2>
                      <p className="text-xs text-muted-foreground">
                        {selectedConversation.contact?.phone_number}
                      </p>
                    </div>
                    <Badge
                      variant={
                        isWindowOpen(selectedConversation)
                          ? "secondary"
                          : "destructive"
                      }
                      className="gap-1"
                      title={describeServiceWindow(getServiceWindowStatus(selectedConversation.last_inbound_at))}
                    >
                      <Clock3 className="h-3 w-3" />
                      {serviceWindowLabel(selectedConversation)}
                    </Badge>
                    <Select
                      value={selectedConversation.status}
                      onValueChange={(status) =>
                        void setConversationField({ status })
                      }
                    >
                      <SelectTrigger className="h-8 w-[105px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="open">Open</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                        <SelectItem value="resolved">Resolved</SelectItem>
                      </SelectContent>
                    </Select>
                  </header>
                  <p className="border-b bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
                    {describeServiceWindow(getServiceWindowStatus(selectedConversation.last_inbound_at))}
                  </p>
                  <div className="flex-1 space-y-2 overflow-y-auto bg-[radial-gradient(#d9d4c7_1px,transparent_1px)] bg-[size:16px_16px] p-4 dark:bg-[#0b141a]">
                    {messages.length === 0 ? (
                      <div className="mx-auto mt-16 max-w-sm rounded-lg bg-background/90 p-4 text-center text-sm text-muted-foreground shadow-sm">
                        Riwayat untuk chat ini belum ada di lokal. Sync semua
                        tetap berjalan bertahap; pesan baru akan langsung muncul
                        lewat webhook.
                      </div>
                    ) : (
                      messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${
                            message.direction === "outbound"
                              ? "justify-end"
                              : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[86%] rounded-lg px-3 py-2 text-sm shadow-sm ${
                              message.direction === "outbound"
                                ? "bg-[#d9fdd3] text-[#111b21] dark:bg-emerald-900 dark:text-emerald-50"
                                : "bg-background"
                            }`}
                          >
                            <InboxMediaPreview message={message} />
                            <p className="whitespace-pre-wrap">
                              {message.body ||
                                (isMediaMessage(message)
                                  ? null
                                  : `[${message.message_type}]`)}
                            </p>
                            <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                              <span>{formatTime(message.created_at)}</span>
                              {message.direction === "outbound" && (
                                <MessageStatus status={message.status} />
                              )}
                            </div>
                            {message.error_message && (
                              <p className="mt-1 text-xs text-destructive">
                                {message.error_message}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                    <div ref={messagesEndRef} />
                  </div>
                  <div className="border-t bg-[#f0f2f5] p-3 dark:bg-[#202c33]">
                    <div className="relative">
                      <Textarea
                        value={draft}
                        onChange={(event) => {
                          setDraft(event.target.value);
                          if (!event.target.value.trimStart().startsWith("/"))
                            setSelectedQuickReplyId(null);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" && !event.shiftKey) {
                            event.preventDefault();
                            void send();
                          }
                        }}
                        disabled={
                          sending || !isWindowOpen(selectedConversation)
                        }
                        placeholder={
                          isWindowOpen(selectedConversation)
                            ? "Tulis pesan atau ketik / untuk Balas Cepat"
                            : "Jendela 24 jam telah berakhir"
                        }
                        className="min-h-14 resize-none rounded-xl bg-background pr-14"
                      />
                      {matchingReplies.length > 0 && (
                        <div className="absolute bottom-full left-0 right-0 mb-2 overflow-hidden rounded-xl border bg-popover shadow-lg">
                          <p className="border-b bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground">
                            Balas Cepat â€” preview pesan sebelum dikirim
                          </p>
                          {matchingReplies.map((reply) => (
                            <button
                              key={`${reply.source}-${reply.id}`}
                              type="button"
                              onClick={() => {
                                setDraft(reply.body);
                                setSelectedQuickReplyId(
                                  reply.source === "quick_reply"
                                    ? reply.id
                                    : null
                                );
                              }}
                              className="block w-full border-b px-3 py-2 text-left last:border-0 hover:bg-muted"
                            >
                              <span className="font-medium">
                                /{reply.shortcut}
                              </span>
                              <span className="ml-2 text-xs text-muted-foreground">
                                {reply.label}
                              </span>
                              <span className="mt-1 block whitespace-pre-wrap text-xs text-muted-foreground">
                                {reply.body}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        Enter kirim · Shift+Enter baris baru
                      </span>
                      <Button
                        onClick={() => void send()}
                        disabled={
                          !draft.trim() ||
                          sending ||
                          !isWindowOpen(selectedConversation)
                        }
                      >
                        {sending ? (
                          "Mengirim…"
                        ) : (
                          <>
                            <Send />
                            Kirim
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="m-auto text-center">
                  <MessageSquareText className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                  <h2 className="font-semibold">WhatsApp Web untuk ILJ</h2>
                  <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                    Pilih percakapan untuk membaca dan membalas customer.
                  </p>
                </div>
              )}
            </>
          </section>
        </div>
      </div>
      <Dialog open={quickReplyDialog} onOpenChange={setQuickReplyDialog}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Balas Cepat</DialogTitle>
            <DialogDescription>
              Shortcut hanya memasukkan isi Pesan Tersimpan ke draft chat. Tidak
              memicu Auto Reply atau Flow Map.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 rounded-xl border p-4 sm:grid-cols-[1fr_180px_auto]">
            <div className="space-y-2">
              <Label>Pesan Tersimpan</Label>
              <Select
                value={quickTemplateId}
                onValueChange={setQuickTemplateId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih pesan" />
                </SelectTrigger>
                <SelectContent>
                  {templates
                    .filter(
                      (template) =>
                        template.is_active && template.type === "text"
                    )
                    .map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Shortcut</Label>
              <Input
                value={quickShortcut}
                onChange={(event) => setQuickShortcut(event.target.value)}
                placeholder="chat"
              />
            </div>
            <Button
              className="self-end"
              onClick={() => void createQuickReply()}
            >
              <Plus />
              Tambah
            </Button>
          </div>
          <div className="space-y-2">
            {quickReplies.map((reply) => (
              <div
                key={reply.id}
                className="flex items-center gap-3 rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <b>/{reply.shortcut}</b>
                  <span className="ml-2 text-sm text-muted-foreground">
                    {reply.template?.name ?? "Pesan sudah dihapus"}
                  </span>
                  <p className="truncate text-xs text-muted-foreground">
                    {reply.template?.body}
                  </p>
                </div>
                <Switch
                  checked={reply.is_active}
                  onCheckedChange={() => void toggleQuickReply(reply)}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`Hapus /${reply.shortcut}`}
                  onClick={() => void deleteQuickReply(reply)}
                >
                  <X className="text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setQuickReplyDialog(false)}
            >
              Selesai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function MessageStatus({ status }: { status: MessageStatus }) {
  if (status === "failed")
    return (
      <span title={statusLabel[status]}>
        <AlertCircle className="h-3.5 w-3.5" />
      </span>
    );
  if (status === "read" || status === "delivered")
    return (
      <span title={statusLabel[status]}>
        <CheckCheck className="h-3.5 w-3.5" />
      </span>
    );
  if (status === "sent")
    return (
      <span title={statusLabel[status]}>
        <Check className="h-3.5 w-3.5" />
      </span>
    );
  return (
    <span title={statusLabel[status]}>
      <Clock3 className="h-3.5 w-3.5" />
    </span>
  );
}
