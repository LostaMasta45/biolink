import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { sendTextMessage } from "@/lib/whatsapp/kirimdev-client";
import { completeInboxManualMessage, listInboxMessages, stageInboxManualMessage } from "@/services/whatsapp-inbox-store";
import { writeActivityLog } from "@/services/whatsapp-audit-service";

interface RouteContext { params: Promise<{ id: string }>; }
const sendSchema = z.object({
  body: z.string().trim().min(1, "Pesan tidak boleh kosong").max(4096, "Pesan maksimal 4096 karakter"),
  clientRequestId: z.string().uuid(),
  quickReplyId: z.string().uuid().nullable().optional(),
});

async function authenticated() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : user;
}

export async function GET(request: NextRequest, context: RouteContext) {
  if (!await authenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    return NextResponse.json(await listInboxMessages(id, request.nextUrl.searchParams.get("before")));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Riwayat pesan tidak dapat dimuat" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  const user = await authenticated();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await context.params;
    const input = sendSchema.parse(await request.json());
    const staged = await stageInboxManualMessage({
      conversationId: id,
      body: input.body,
      clientRequestId: input.clientRequestId,
      userId: user.id,
      quickReplyId: input.quickReplyId ?? null,
    });
    if (staged.alreadyExists) return NextResponse.json({ data: staged.message, idempotent: true });

    const result = await sendTextMessage(
      staged.conversation.account.phone_number_id,
      staged.conversation.contact?.phone_number ?? "",
      input.body,
      {
        source: input.quickReplyId ? "quick_reply" : "manual_inbox",
        correlationId: input.clientRequestId,
      },
    );
    const message = await completeInboxManualMessage({
      messageId: staged.message.id,
      conversationId: id,
      providerMessageId: result.messageId,
      error: result.success ? undefined : result.error ?? "KirimDev menolak pengiriman",
    });
    if (!result.success) return NextResponse.json({ error: result.error ?? "KirimDev menolak pengiriman", data: message }, { status: 502 });
    return NextResponse.json({ data: message }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pesan tidak dapat dikirim";
    if (message.startsWith("Jendela layanan WhatsApp")) {
      const { id } = await context.params;
      await writeActivityLog({
        customer: `inbox:${id}`,
        eventType: "inbox.message.blocked_24h",
        status: "skipped",
        message,
        metadata: { conversation_id: id, reason: "outside_or_unknown_24h_window" },
      });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
