import { NextRequest, NextResponse } from 'next/server';
import {
  getAllAccounts,
  testConnection,
  sendToSelf,
  sendTextMessage,
} from '@/lib/whatsapp/kirimdev-client';
import { COMMANDS } from '@/lib/whatsapp/command-processor';

// ============================================
// WhatsApp Admin API
// Endpoint: /api/admin/whatsapp
//
// Digunakan oleh dashboard admin untuk:
// - GET:  Ambil info akun, status koneksi, daftar command
// - POST: Test kirim pesan, toggle command, test self-trigger
// ============================================

export async function GET(req: NextRequest) {
  try {
    const accounts = getAllAccounts();

    // Ambil daftar command
    const commands = Object.entries(COMMANDS).map(([name, cmd]) => ({
      name,
      description: cmd.description,
      usage: cmd.usage,
      enabled: cmd.enabled,
    }));

    return NextResponse.json({
      accounts: accounts.map(a => ({
        phoneId: a.phoneId,
        label: a.label,
        phoneNumber: a.phoneNumber,
      })),
      commands,
      webhookUrl: `${req.nextUrl.origin}/api/webhook/whatsapp`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, phoneId, message, to } = body;

    switch (action) {
      // ─── Test koneksi ke KirimDev ───
      case 'test_connection': {
        if (!phoneId) {
          return NextResponse.json({ error: 'phoneId diperlukan' }, { status: 400 });
        }
        const result = await testConnection(phoneId);
        return NextResponse.json(result);
      }

      // ─── Test kirim pesan ke nomor sendiri ───
      case 'test_self_trigger': {
        if (!phoneId) {
          return NextResponse.json({ error: 'phoneId diperlukan' }, { status: 400 });
        }
        const testMsg = message || '🧪 *Test Self-Trigger*\n\nIni adalah pesan test dari ILJ-Hub Dashboard.\nJika Anda melihat pesan ini, webhook sudah terhubung dengan benar!\n\nKetik *!help* untuk melihat daftar command.';
        const result = await sendToSelf(phoneId, testMsg);
        return NextResponse.json({
          ...result,
          message: result.success
            ? 'Pesan test berhasil dikirim ke nomor sendiri'
            : 'Gagal mengirim pesan test',
        });
      }

      // ─── Kirim pesan ke nomor tertentu ───
      case 'send_message': {
        if (!phoneId || !to || !message) {
          return NextResponse.json(
            { error: 'phoneId, to, dan message diperlukan' },
            { status: 400 }
          );
        }
        const result = await sendTextMessage(phoneId, to, message);
        return NextResponse.json(result);
      }

      default:
        return NextResponse.json(
          { error: `Action "${action}" tidak dikenali` },
          { status: 400 }
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
