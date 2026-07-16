import { createClient } from '@supabase/supabase-js';
import { sendMappedTemplate, type TemplateData } from './kirimdev-mapper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * Dapatkan Phone ID Admin Utama — nomor yang digunakan untuk MENGIRIM balasan
 */
function getAdminPhoneId(): string {
  return process.env.KIRIMDEV_PHONE_ID || process.env.KIRIMDEV_PHONE_ID_1 || '';
}

/**
 * Log aktivitas eksekusi ke tabel `logs`
 */
async function logActivity(
  customer: string,
  eventType: string,
  status: 'success' | 'failed' | 'pending',
  message?: string,
  automationId?: string | null,
  templateId?: string | null,
  metadata: any = {}
) {
  try {
    await supabase.from('logs').insert({
      customer,
      event_type: eventType,
      status,
      message,
      automation_id: automationId,
      template_id: templateId,
      metadata
    });
  } catch (err) {
    console.error('[ExecutionEngine] Failed to log activity:', err);
  }
}

/**
 * Log webhook raw event
 */
export async function logWebhookEvent(
  direction: 'incoming' | 'outgoing',
  eventType: string,
  status: 'success' | 'failed' | 'retry',
  payload: any,
  latencyMs: number = 0
) {
  try {
    await supabase.from('webhook_logs').insert({
      direction,
      event_type: eventType,
      status,
      payload,
      latency_ms: latencyMs,
      retry_count: 0
    });
  } catch (err) {
    console.error('[ExecutionEngine] Failed to log webhook:', err);
  }
}

/**
 * Fungsi utama untuk memproses pesan masuk dari Customer
 * 
 * Alur:
 * 1. Cek keyword di tabel `auto_reply` — ini fitur AUTO REPLY sederhana
 * 2. Jika tidak match, cek di tabel `automation` — ini fitur AUTOMATION lanjutan
 * 3. Selalu gunakan Admin Utama (KIRIMDEV_PHONE_ID) sebagai pengirim
 */
export async function processCustomerMessage(webhookPhoneId: string, senderPhone: string, text: string) {
  const adminPhoneId = getAdminPhoneId();
  const senderPhoneId = adminPhoneId || webhookPhoneId; // Prioritas: Admin Utama, fallback ke webhook phoneId

  console.log(`[ExecutionEngine] ═══════════════════════════════════════`);
  console.log(`[ExecutionEngine] Processing message from ${senderPhone}: "${text}"`);
  console.log(`[ExecutionEngine] Webhook PhoneID: ${webhookPhoneId} | Sender PhoneID (Admin): ${senderPhoneId}`);
  
  try {
    const lowerText = text.toLowerCase().trim();

    // ════════════════════════════════════════════════
    //  STEP 1: CEK AUTO REPLY (tabel `auto_reply`)
    // ════════════════════════════════════════════════
    console.log(`[ExecutionEngine] [Step 1] Checking auto_reply table for keyword match...`);
    
    const { data: autoReplies, error: arError } = await supabase
      .from('auto_reply')
      .select('*, template:templates(*)')
      .eq('is_active', true)
      .order('keyword', { ascending: true });

    if (arError) {
      console.error(`[ExecutionEngine] DB Error fetching auto_reply:`, arError);
    }

    console.log(`[ExecutionEngine] Found ${autoReplies?.length || 0} active auto-reply rules`);

    if (autoReplies && autoReplies.length > 0) {
      for (const rule of autoReplies) {
        const keyword = (rule.keyword || '').toLowerCase().trim();
        const matchType = rule.match_type || 'contains'; // default: contains
        let matched = false;

        if (!keyword) continue; // Skip empty keywords

        switch (matchType) {
          case 'equals':
            matched = (lowerText === keyword);
            break;
          case 'contains':
            matched = lowerText.includes(keyword);
            break;
          case 'starts_with':
            matched = lowerText.startsWith(keyword);
            break;
          default:
            matched = lowerText.includes(keyword);
        }

        console.log(`[ExecutionEngine] Auto-reply check: keyword="${keyword}" (${matchType}) vs text="${lowerText}" → ${matched ? '✅ MATCH' : '❌ no match'}`);

        if (matched && rule.template) {
          console.log(`[ExecutionEngine] ✅ AUTO-REPLY MATCH! Sending template "${rule.template.name}" from Admin Utama (${senderPhoneId}) to ${senderPhone}`);
          
          const res = await sendMappedTemplate(senderPhoneId, senderPhone, rule.template as TemplateData);
          console.log(`[ExecutionEngine] sendMappedTemplate result:`, JSON.stringify(res));

          await logActivity(
            senderPhone,
            'auto_reply_triggered',
            res.success ? 'success' : 'failed',
            res.error || `Auto-reply: "${rule.keyword}" → template "${rule.template.name}"`,
            null,
            rule.template_id,
            { keyword: rule.keyword, match_type: matchType, text_received: text, sender_phone_id: senderPhoneId }
          );

          if (res.success) {
            console.log(`[ExecutionEngine] ✅ Auto-reply sent successfully!`);
            return; // Auto-reply berhasil, stop
          } else {
            console.error(`[ExecutionEngine] ❌ Auto-reply failed to send:`, res.error);
            // Lanjut ke rule berikutnya atau automation
          }
        }
      }
    }

    // ════════════════════════════════════════════════
    //  STEP 2: CEK AUTOMATION (tabel `automation`)
    // ════════════════════════════════════════════════
    console.log(`[ExecutionEngine] [Step 2] Checking automation table...`);

    let query = supabase
      .from('automation')
      .select('*, template:templates(*)')
      .eq('is_active', true)
      .eq('trigger_type', 'Saat pesan masuk');

    // Query: automation tanpa phone_id ATAU yang cocok dengan webhookPhoneId
    if (webhookPhoneId) {
      query = query.or(`phone_id.is.null,phone_id.eq.${webhookPhoneId}`);
    } else {
      query = query.is('phone_id', null);
    }

    const { data: automations, error: autoErr } = await query.order('phone_id', { ascending: false });

    if (autoErr) {
      console.error(`[ExecutionEngine] DB Error fetching automations:`, autoErr);
    }

    console.log(`[ExecutionEngine] Found ${automations?.length || 0} active automation rules`);

    if (!automations || automations.length === 0) {
      console.log(`[ExecutionEngine] No automation rules matched. Done.`);
      return;
    }

    for (const automation of automations) {
      let conditionMatched = false;
      const config = automation.condition_config;
      console.log(`[ExecutionEngine] Evaluating automation: "${automation.name}" | config:`, JSON.stringify(config));
      
      // Evaluasi Keyword Condition
      if (config && config.field === 'keyword') {
        const expectedVal = String(config.value || '').toLowerCase().trim();
        if (!expectedVal) {
          conditionMatched = true; // Empty value = match all
        } else {
          switch (config.operator) {
            case 'equals':
              conditionMatched = (lowerText === expectedVal);
              break;
            case 'contains':
              conditionMatched = lowerText.includes(expectedVal);
              break;
            case 'not_equals':
              conditionMatched = (lowerText !== expectedVal);
              break;
            case 'starts_with':
              conditionMatched = lowerText.startsWith(expectedVal);
              break;
            default:
              conditionMatched = true;
          }
        }
      } else {
        conditionMatched = true; // No specific condition = match all
      }

      console.log(`[ExecutionEngine] Automation "${automation.name}" condition → ${conditionMatched ? '✅ MATCH' : '❌ no match'}`);

      if (conditionMatched) {
        console.log(`[ExecutionEngine] ✅ Automation "${automation.name}" MATCHED! Action: ${automation.action_type}`);
        
        // EKSEKUSI ACTION — selalu gunakan Admin Utama sebagai pengirim
        if (['Kirim template', 'Kirim quick reply'].includes(automation.action_type) && automation.template) {
          console.log(`[ExecutionEngine] Sending template "${automation.template.name}" from Admin Utama (${senderPhoneId}) to ${senderPhone}`);
          const res = await sendMappedTemplate(senderPhoneId, senderPhone, automation.template as TemplateData);
          console.log(`[ExecutionEngine] sendMappedTemplate result:`, JSON.stringify(res));
          
          await logActivity(
            senderPhone, 
            'automation_triggered', 
            res.success ? 'success' : 'failed',
            res.error || `Automation: "${automation.name}" → template "${automation.template.name}"`,
            automation.id,
            automation.template.id,
            { text_received: text, sender_phone_id: senderPhoneId }
          );
        }

        // Hanya eksekusi 1 rule pertama yang cocok
        break;
      }
    }

    console.log(`[ExecutionEngine] ═══════════════════════════════════════`);

  } catch (error) {
    console.error('[ExecutionEngine] Unhandled error:', error);
  }
}
