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

    console.log('[Webhook] 📨 Event:', payload.event, '| From:', payload.data?.from, '| To:', payload.data?.to);

    // ─── Hanya proses event pesan yang relevan ───
    if (payload.event !== 'message.received' && payload.event !== 'message.sent') {
      // Event lain (status, revoked, dll) — acknowledge saja
      return NextResponse.json({ status: 'ok', event: payload.event, action: 'ignored' });
    }

    // ─── Skip jika tidak ada konten pesan ───
    if (!payload.data?.message?.text) {
      return NextResponse.json({ status: 'ok', action: 'no_text_content' });
    }

    const senderPhone = payload.data.from;
    const text = payload.data.message.text.trim();

    // ═══════════════════════════════════════════
    //  ROUTING LOGIC
    // ═══════════════════════════════════════════

    // CASE 1: ADMIN COMMAND
    // Pesan dari nomor Admin (Pribadi) DAN diawali "!"
    if (isAdminNumber(senderPhone) && text.startsWith('!')) {
      console.log('[Webhook] 🤖 Admin command detected:', text);

      // Tentukan phone ID mana yang menerima pesan ini
      // Prioritas: dari payload.data.phoneId, lalu dari payload.data.to
      let phoneId = payload.data.phoneId || '';
      let accountLabel = 'Unknown';

      if (phoneId) {
        const account = getAccountByPhoneId(phoneId);
        accountLabel = account?.label || 'Unknown';
      } else if (payload.data.to) {
        // Fallback: cari berdasarkan nomor tujuan
        const account = getAccountByPhone(payload.data.to);
        if (account) {
          phoneId = account.phoneId;
          accountLabel = account.label;
        }
      }

      // Fallback terakhir: gunakan akun pertama
      if (!phoneId) {
        const accounts = getAllAccounts();
        if (accounts.length > 0) {
          phoneId = accounts[0].phoneId;
          accountLabel = accounts[0].label;
        }
      }

      if (!phoneId) {
        console.error('[Webhook] ❌ Tidak bisa menentukan phoneId untuk self-trigger');
        return NextResponse.json({ status: 'error', message: 'No phoneId available' }, { status: 500 });
      }

      // Proses command secara async (agar webhook cepat return 200)
      // KirimDev butuh response dalam < 5 detik
      processCommand(phoneId, senderPhone, text).catch(err => {
        console.error('[Webhook] Command processing failed:', err);
      });

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
