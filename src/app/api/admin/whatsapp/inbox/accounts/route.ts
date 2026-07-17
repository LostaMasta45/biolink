import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAllAccounts } from "@/lib/whatsapp/kirimdev-client";
import { syncInboxAccounts } from "@/services/whatsapp-inbox-store";

async function authenticated() { const supabase = await createClient(); const { data: { user }, error } = await supabase.auth.getUser(); return error || !user ? null : user; }

export async function GET() {
  if (!await authenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json({ data: await syncInboxAccounts(await getAllAccounts()) }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Akun Inbox tidak dapat dimuat" }, { status: 500 }); }
}
