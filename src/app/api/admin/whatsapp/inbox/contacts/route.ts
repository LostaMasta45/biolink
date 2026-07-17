import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listInboxContacts } from "@/services/whatsapp-inbox-store";

async function authenticated() { const supabase = await createClient(); const { data: { user }, error } = await supabase.auth.getUser(); return error || !user ? null : user; }

export async function GET(request: NextRequest) {
  if (!await authenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const query = request.nextUrl.searchParams;
    return NextResponse.json(await listInboxContacts({ accountId: query.get("account_id"), search: query.get("search"), cursor: query.get("cursor"), limit: Number(query.get("limit") ?? "50") }));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Kontak tidak dapat dimuat" }, { status: 500 }); }
}
