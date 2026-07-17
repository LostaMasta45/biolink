"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ContactRound, LoaderCircle, RefreshCcw, Search, UsersRound } from "lucide-react";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface InboxAccount { id: string; label: string; phone_number: string | null; role: "admin" | "bot"; }
interface InboxContact { id: string; phone_number: string; name: string | null; profile_name: string | null; last_synced_at: string | null; updated_at: string; }
interface ContactsResponse { data: InboxContact[]; nextCursor: string | null; total: number; }

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const payload = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Permintaan gagal");
  return payload;
}

function formatDate(value: string | null) {
  if (!value) return "Belum disinkronkan";
  return new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function InboxContactsManager() {
  const [accounts, setAccounts] = useState<InboxAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [contacts, setContacts] = useState<InboxContact[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState("");

  const loadAccounts = useCallback(async () => {
    const result = await api<{ data: InboxAccount[] }>("/api/admin/whatsapp/inbox/accounts");
    setAccounts(result.data);
    setAccountId((current) => current && result.data.some((account) => account.id === current) ? current : result.data[0]?.id ?? "");
  }, []);

  const loadContacts = useCallback(async (cursor?: string | null, append = false) => {
    if (!accountId) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    try {
      const params = new URLSearchParams({ account_id: accountId, limit: "100" });
      if (search.trim()) params.set("search", search.trim());
      if (cursor) params.set("cursor", cursor);
      const result = await api<ContactsResponse>(`/api/admin/whatsapp/inbox/contacts?${params}`);
      setContacts((current) => append ? [...current, ...result.data] : result.data);
      setNextCursor(result.nextCursor);
      setTotal(result.total);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kontak tidak dapat dimuat");
    } finally {
      if (append) setLoadingMore(false);
      else setLoading(false);
    }
  }, [accountId, search]);

  useEffect(() => { void loadAccounts().catch((error) => toast.error(error instanceof Error ? error.message : "Akun tidak dapat dimuat")); }, [loadAccounts]);
  useEffect(() => { void loadContacts(); }, [loadContacts]);

  const syncContacts = async () => {
    if (!accountId || syncing) return;
    setSyncing(true);
    let synced = 0;
    try {
      let hasMore = true;
      let page = 0;
      while (hasMore) {
        page += 1;
        setProgress(`Sinkronisasi batch ${page} · ${synced.toLocaleString("id-ID")} kontak diperbarui`);
        const result = await api<{ processed: number; hasMore: boolean }>("/api/admin/whatsapp/inbox/sync", { method: "POST", body: JSON.stringify({ accountId, resource: "contacts" }) });
        synced += result.processed;
        hasMore = result.hasMore;
      }
      setProgress(`Sinkronisasi selesai · ${synced.toLocaleString("id-ID")} kontak diperbarui`);
      toast.success("Kontak sudah tersinkron");
      await loadContacts();
    } catch (error) {
      setProgress("Sinkronisasi berhenti. Periksa log untuk detail.");
      toast.error(error instanceof Error ? error.message : "Sync kontak gagal");
    } finally {
      setSyncing(false);
    }
  };

  const account = accounts.find((item) => item.id === accountId);
  const visibleLabel = search.trim() ? `${contacts.length.toLocaleString("id-ID")} hasil ditampilkan` : `${contacts.length.toLocaleString("id-ID")} dari ${total.toLocaleString("id-ID")}`;

  return (
    <div className="space-y-4 overflow-hidden">
      <section className="rounded-2xl border bg-card/90 p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="min-w-0">
            <Button asChild size="sm" variant="ghost" className="-ml-2 mb-2"><Link href="/admin/inbox"><ArrowLeft />Kembali ke Inbox</Link></Button>
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"><UsersRound className="h-5 w-5" /></div>
              <div className="min-w-0"><h1 className="text-xl font-bold tracking-tight sm:text-2xl">Kontak WhatsApp</h1><p className="mt-1 text-sm text-muted-foreground">Direktori kontak lokal yang disinkron bertahap dari KirimDev.</p></div>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Select value={accountId} onValueChange={setAccountId}><SelectTrigger className="w-full sm:w-[210px]"><SelectValue placeholder="Pilih akun" /></SelectTrigger><SelectContent>{accounts.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select>
            <Button onClick={() => void syncContacts()} disabled={!accountId || syncing} className="shrink-0">{syncing ? <LoaderCircle className="animate-spin" /> : <RefreshCcw />}{syncing ? "Menyinkronkan" : "Sinkronkan kontak"}</Button>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b bg-muted/30 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-background text-emerald-600 shadow-sm"><ContactRound className="h-4 w-4" /></div><div><p className="text-sm font-semibold">{total.toLocaleString("id-ID")} kontak tersimpan</p><p className="text-xs text-muted-foreground">{account ? `${account.label} · ${account.role === "bot" ? "Akun Bot" : "Admin Utama"}` : "Memuat akun"}</p></div></div>
          <div className="relative w-full sm:max-w-xs"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau nomor" className="bg-background pl-9" /></div>
        </div>
        {progress && <div className="border-b bg-emerald-500/5 px-4 py-2 text-xs font-medium text-emerald-700 dark:text-emerald-400">{progress}</div>}
        <div className="px-4 py-3 text-xs text-muted-foreground sm:px-5">{visibleLabel}</div>
        {loading ? <p className="py-14 text-center text-sm text-muted-foreground">Memuat kontak…</p> : contacts.length === 0 ? <div className="py-16 text-center"><ContactRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">Belum ada kontak untuk akun ini</p><p className="mt-1 text-sm text-muted-foreground">Sinkronisasi otomatis tetap berjalan. Anda juga bisa menjalankannya sekarang.</p></div> : <>
          <div className="hidden grid-cols-[minmax(0,1.3fr)_minmax(160px,1fr)_140px] gap-4 border-y bg-muted/20 px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid"><span>Kontak</span><span>Nomor WhatsApp</span><span>Terakhir diperbarui</span></div>
          <div className="divide-y">{contacts.map((contact) => <article key={contact.id} className="grid gap-1 px-4 py-3 transition-colors hover:bg-muted/30 md:grid-cols-[minmax(0,1.3fr)_minmax(160px,1fr)_140px] md:items-center md:gap-4 md:px-5"><div className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-500/10 text-sm font-semibold text-emerald-700 dark:text-emerald-400">{(contact.name || contact.profile_name || contact.phone_number).slice(0, 1).toUpperCase()}</div><div className="min-w-0"><p className="truncate text-sm font-semibold">{contact.name || contact.profile_name || "Tanpa nama"}</p>{contact.profile_name && contact.name && contact.profile_name !== contact.name && <p className="truncate text-xs text-muted-foreground">{contact.profile_name}</p>}</div></div><p className="pl-12 font-mono text-xs text-muted-foreground md:pl-0">{contact.phone_number}</p><p className="pl-12 text-xs text-muted-foreground md:pl-0">{formatDate(contact.last_synced_at || contact.updated_at)}</p></article>)}</div>
          {nextCursor && <div className="border-t p-4 text-center"><Button variant="outline" onClick={() => void loadContacts(nextCursor, true)} disabled={loadingMore}>{loadingMore ? <LoaderCircle className="animate-spin" /> : null}Muat 100 kontak berikutnya</Button></div>}
        </>}
      </section>
    </div>
  );
}
