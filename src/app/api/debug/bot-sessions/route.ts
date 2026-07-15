import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET /api/debug/bot-sessions
 * Cek isi tabel bot_sessions untuk debugging
 * 
 * Optional query params:
 *   ?phone=628xxx  → filter by sender_phone
 *   ?clear=true    → hapus semua session (reset)
 */
export async function GET(req: NextRequest) {
  const phone = req.nextUrl.searchParams.get('phone');
  const clear = req.nextUrl.searchParams.get('clear');

  // Clear all sessions if requested
  if (clear === 'true') {
    const { error } = await supabase.from('bot_sessions').delete().neq('phone_id', '');
    return NextResponse.json({
      action: 'cleared_all_sessions',
      error: error?.message || null,
      timestamp: new Date().toISOString(),
    });
  }

  // Query sessions
  let query = supabase.from('bot_sessions').select('*');
  if (phone) {
    query = query.eq('sender_phone', phone);
  }

  const { data: sessions, error } = await query;

  // Also test: can we insert and delete?
  const testResult: any = {};
  if (!phone) {
    // Quick sanity check: test insert+delete
    const testPhone = '__debug_test__';
    const { error: insertErr } = await supabase.from('bot_sessions').insert({
      phone_id: 'test_phone_id',
      sender_phone: testPhone,
      state: 'TEST',
      data: {},
    });
    testResult.insert = insertErr ? `FAIL: ${insertErr.message}` : 'OK';

    if (!insertErr) {
      const { error: deleteErr } = await supabase.from('bot_sessions').delete().eq('sender_phone', testPhone);
      testResult.delete = deleteErr ? `FAIL: ${deleteErr.message}` : 'OK';
    }
  }

  return NextResponse.json({
    total_sessions: sessions?.length || 0,
    sessions: sessions || [],
    error: error?.message || null,
    db_test: testResult,
    timestamp: new Date().toISOString(),
  });
}
