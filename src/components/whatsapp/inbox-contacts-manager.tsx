"use client";

import { useCallback, useEffect, useState } from "react";
import { ContactRound, RefreshCcw, Search } from "lucide-react";
import toast from "react-hot-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface InboxAccount { id: string; label: string; phone_number: string | null; role: "admin" | "bot"; }
interface InboxContact { id: string; phone_number: string; name: string | null; profile_name: string | null; last_synced_at: string | null; updated_at: string; }

async function api<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...init?.headers } }); const payload = await response.json() as T & { error?: string }; if (!response.ok) throw new Error(payload.error ?? "Permintaan gagal"); return payload; }

export function InboxContactsManager() {
  const [accounts, setAccounts] = useState<InboxAccount[]>([]);
  const [accountId, setAccountId] = useState("");
  const [contacts, setContacts] = useState<InboxContact[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const loadAccounts = useCallback(async () => { const result = await api<{ data: InboxAccount[] }>("/api/admin/whatsapp/inbox/accounts"); setAccounts(result.data); setAccountId((current) => current && result.data.some((account) => account.id === current) ? current : result.data[0]?.id ?? ""); }, []);
  const loadContacts = useCallback(async () => { if (!accountId) return; setLoading(true); try { const params = new URLSearchParams({ account_id: accountId }); if (search.trim()) params.set("search", search.trim()); const result = await api<{ data: InboxContact[] }>(`/api/admin/whatsapp/inbox/contacts?${params}`); setContacts(result.data); } catch (error) { toast.error(error instanceof Error ? error.message : "Kontak tidak dapat dimuat"); } finally { setLoading(false); } }, [accountId, search]);
  useEffect(() => { void loadAccounts().catch((error) => toast.error(error instanceof Error ? error.message : "Akun tidak dapat dimuat")); }, [loadAccounts]);
  useEffect(() => { void loadContacts(); }, [loadContacts]);

  const syncContacts = async () => { if (!accountId) return; try { const result = await api<{ message: string }>("/api/admin/whatsapp/inbox/sync", { method: "POST", body: JSON.stringify({ accountId, resource: "contacts" }) }); toast.success(result.message); await loadContacts(); } catch (error) { toast.error(error instanceof Error ? error.message : "Sync kontak gagal"); } };

  return <div className="space-y-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 className="text-2xl font-bold tracking-tight">Kontak WhatsApp</h2><p className="text-sm text-muted-foreground">Kontak lokal per akun. Sync berjalan bertahap, satu halaman KirimDev per klik.</p></div><div className="flex flex-wrap gap-2"><Select value={accountId} onValueChange={setAccountId}><SelectTrigger className="w-[190px]"><SelectValue placeholder="Pilih akun" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.label}</SelectItem>)}</SelectContent></Select><Button onClick={() => void syncContacts()} disabled={!accountId}><RefreshCcw />Sync kontak</Button></div></div><Card><CardContent className="p-4"><div className="relative mb-4"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau nomor" className="pl-9" /></div>{loading ? <p className="py-8 text-center text-sm text-muted-foreground">Memuat kontak…</p> : contacts.length === 0 ? <div className="py-10 text-center"><ContactRound className="mx-auto mb-3 h-10 w-10 text-muted-foreground" /><p className="font-medium">Belum ada kontak</p><p className="mt-1 text-sm text-muted-foreground">Klik Sync kontak untuk memuat batch pertama dari KirimDev.</p></div> : <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{contacts.map((contact) => <div key={contact.id} className="rounded-xl border p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-medium">{contact.name || contact.profile_name || "Tanpa nama"}</p><p className="text-sm text-muted-foreground">{contact.phone_number}</p></div><Badge variant="secondary">Tersimpan</Badge></div></div>)}</div>}</CardContent></Card></div>;
}
