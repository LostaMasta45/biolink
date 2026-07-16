import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { emitNotification } from "@/services/whatsapp-notification-service";

const ALLOWED_ADMIN_EVENTS = new Set(["invoice.created.admin"]);

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json() as { eventKey?: string; variables?: Record<string, unknown>; dedupeId?: string };
  if (!body.eventKey || !ALLOWED_ADMIN_EVENTS.has(body.eventKey)) return NextResponse.json({ error: "Event tidak diizinkan" }, { status: 400 });
  const result = await emitNotification({ eventKey: body.eventKey, variables: body.variables ?? {}, dedupeId: body.dedupeId });
  if (result.status === "failed") return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json(result);
}
