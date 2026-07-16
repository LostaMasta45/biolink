import { NextRequest, NextResponse } from "next/server";
import { processDueAutoReplyJobs } from "@/services/whatsapp-execution-engine";
import { writeWebhookLog } from "@/services/whatsapp-audit-service";
import { processDueNotificationJobs } from "@/services/whatsapp-notification-service";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const startedAt = Date.now();
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if ((!secret && process.env.NODE_ENV === "production") || (secret && authorization !== `Bearer ${secret}`)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [autoReply, notifications] = await Promise.all([processDueAutoReplyJobs(50), processDueNotificationJobs(50)]);
    const result = { autoReply, notifications };
    await writeWebhookLog("outgoing", "auto_reply.worker", "success", result, Date.now() - startedAt);
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Worker auto reply gagal";
    await writeWebhookLog("outgoing", "auto_reply.worker", "failed", { error: message }, Date.now() - startedAt);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
