import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { fetchKirimDevMessageMedia } from "@/lib/whatsapp/kirimdev-client";
import { getInboxMediaAttachment } from "@/services/whatsapp-inbox-store";

interface RouteContext { params: Promise<{ messageId: string }>; }

async function authenticated() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error || !user ? null : user;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  if (!await authenticated()) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { messageId } = await context.params;
    const attachment = await getInboxMediaAttachment(messageId);
    const upstream = attachment.media_url
      ? await fetch(attachment.media_url, { cache: "no-store" })
      : null;
    const media = upstream?.ok
      ? { bytes: await upstream.arrayBuffer(), contentType: upstream.headers.get("content-type") ?? attachment.media_mime_type ?? "application/octet-stream" }
      : await fetchKirimDevMessageMedia(attachment.account!.phone_number_id, attachment.provider_wamid ?? attachment.provider_message_id!);
    return new NextResponse(media.bytes, {
      headers: {
        "Content-Type": media.contentType,
        "Content-Disposition": `inline; filename="${(attachment.media_filename ?? "attachment").replace(/[\r\n\\"]/g, "_")}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Media Inbox tidak dapat dimuat" }, { status: 404 });
  }
}
