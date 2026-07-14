import { NextRequest, NextResponse } from 'next/server';
import { isAdminNumber, getAccountByPhoneId, getAllAccounts, getAccountByPhone } from '@/lib/whatsapp/kirimdev-client';
import { processCommand } from '@/lib/whatsapp/command-processor';
import type { KirimDevWebhookPayload } from '@/lib/whatsapp/types';

// ============================================
// WhatsApp Webhook Receiver
// Endpoint: POST /api/webhook/whatsapp
//
// URL ini didaftarkan di Dashboard KirimDev:
//   Settings → Webhook → URL endpoint
//   https://your-domain.com/api/webhook/whatsapp
//
// Events yang di-subscribe:
//   ✅ message.received
//   ✅ message.sent
// ============================================

export async function POST(req: NextRequest) {
  try {
    const payload: KirimDevWebhookPayload = await req.json();

    // ─── Ekstrak data dari payload ───
    let eventName = payload.event;
    let senderPhone = payload.data?.from;
    let text = payload.data?.message?.text;
    let phoneId = payload.data?.phoneId || '';
    let toPhone = payload.data?.to || '';

    // Coba parse format WhatsApp Cloud API (yang diteruskan oleh KirimDev)
    if (payload.entry && payload.entry.length > 0) {
      const changes = payload.entry[0].changes;
      if (changes && changes.length > 0) {
        const value = changes[0].value;
        if (value && value.messages && value.messages.length > 0) {
          const msg = value.messages[0];
          senderPhone = msg.from;
          if (msg.type === 'text' && msg.text) {
            text = msg.text.body;
          } else if (msg.type === 'interactive' && msg.interactive) {
            if (msg.interactive.type === 'button_reply') {
              text = msg.interactive.button_reply.id;
            } else if (msg.interactive.type === 'list_reply') {
              text = msg.interactive.list_reply.id;
            }
          }
          phoneId = value.metadata?.phone_number_id || phoneId;
          toPhone = value.metadata?.display_phone_number || toPhone;
          eventName = 'message.received'; // asumsikan ini pesan masuk
        }
      }
    }

    console.log('[Webhook] 📨 Event:', eventName, '| From:', senderPhone, '| To:', toPhone);

    if (!eventName || !senderPhone || !text) {
      // Bukan event pesan teks masuk, abaikan saja
      return NextResponse.json({ status: 'ok', action: 'ignored_or_no_text' });
    }

    text = text.trim();

    // ═══════════════════════════════════════════
    //  ROUTING LOGIC
    // ═══════════════════════════════════════════

    // CASE 1: ADMIN COMMAND & CONVERSATION STATE
    if (isAdminNumber(senderPhone)) {
      console.log('[Webhook] 🤖 Admin command detected:', text);

      let accountLabel = 'Unknown';
      if (phoneId) {
        const account = getAccountByPhoneId(phoneId);
        accountLabel = account?.label || 'Unknown';
      }

      if (!phoneId && toPhone) {
        const account = getAccountByPhone(toPhone);
        if (account) {
          phoneId = account.phoneId;
          accountLabel = account.label;
        }
      }

      if (!phoneId) {
        console.error('[Webhook] ❌ Tidak bisa menentukan phoneId untuk membalas');
        return NextResponse.json({ status: 'error', message: 'No phoneId available' }, { status: 500 });
      }

      try {
        await processCommand(phoneId, senderPhone, text);
      } catch (err) {
        console.error('[Webhook] Command processing failed:', err);
      }

      return NextResponse.json({
        status: 'ok',
        type: 'self-trigger',
        command: text.split(/\s+/)[0],
        via: accountLabel,
      });
    }

    // CASE 2: PESAN DARI CUSTOMER
    // Biarkan KirimDev Automation Rules yang handle auto-reply
    // Di sini kita hanya log atau trigger notifikasi tambahan jika perlu

    console.log('[Webhook] 👤 Customer message from:', senderPhone, '| Text:', text.substring(0, 50));

    // (Opsional) Contoh: kirim notifikasi ke admin jika ada kata "urgent"
    // if (text.toLowerCase().includes('urgent')) {
    //   await sendNotifToAdmin(`🚨 Pesan URGENT dari ${payload.data.pushName || senderPhone}:\n\n${text}`);
    // }

    return NextResponse.json({
      status: 'ok',
      type: 'customer',
      action: 'delegated_to_kirimdev',
    });

  } catch (error) {
    console.error('[Webhook] ❌ Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: (error as Error).message },
      { status: 500 }
    );
  }
}

// ============================================
// GET - Verifikasi webhook (health check)
// KirimDev mungkin mengirim GET untuk verifikasi
// ============================================

export async function GET(req: NextRequest) {
  const challenge = req.nextUrl.searchParams.get('challenge');
  if (challenge) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({
    status: 'active',
    service: 'ILJ-Hub WhatsApp Webhook',
    timestamp: new Date().toISOString(),
    accounts: getAllAccounts().map(a => ({
      label: a.label,
      phoneId: a.phoneId ? '***' + a.phoneId.slice(-4) : 'N/A',
    })),
  });
}
