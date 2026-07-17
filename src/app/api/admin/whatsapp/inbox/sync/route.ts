import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAllAccounts } from "@/lib/whatsapp/kirimdev-client";
import { listInboxAccounts, syncInboxAccounts } from "@/services/whatsapp-inbox-store";
import { syncInboxProviderPage } from "@/services/whatsapp-inbox-sync-service";

const schema = z.object({ accountId: z.string().uuid(), resource: z.enum(["conversations", "messages", "contacts"]), restart: z.boolean().optional() });
async function authenticated() { const supabase = await createClient(); const { data: { user }, error } = await supabase.auth.getUser(); return error || !user ? null : user; }

export async function POST(request: NextRequest) {
  if (!await authenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const input = schema.parse(await request.json());
    await syncInboxAccounts(await getAllAccounts());
    const account = (await listInboxAccounts()).find((item) => item.id === input.accountId);
    if (!account) return NextResponse.json({ error: "Akun Inbox tidak ditemukan" }, { status: 404 });
    return NextResponse.json(await syncInboxProviderPage({ account, resource: input.resource, restart: input.restart }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Sync Inbox gagal" }, { status: 400 }); }
}
