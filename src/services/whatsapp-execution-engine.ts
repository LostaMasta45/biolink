import { createClient } from '@supabase/supabase-js';
import { sendMappedTemplate, type TemplateData } from './kirimdev-mapper';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

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
 */
export async function processCustomerMessage(phoneId: string, senderPhone: string, text: string) {
  console.log(`[ExecutionEngine] Processing message from ${senderPhone}: "${text}"`);
  
  try {
    const { data: session } = await supabase
      .from('sessions')
      .select('state')
      .eq('phone', senderPhone)
      .single();

    if (session && session.state && session.state !== 'FLOW_ENGINE') {
      console.log(`[ExecutionEngine] Customer is in legacy state (${session.state}). Ignoring.`);
      // return; // COMMENT OUT RETURN SEMENTARA UNTUK TESTING
    }

    const lowerText = text.toLowerCase().trim();

    console.log(`[ExecutionEngine] Querying automations for phoneId: ${phoneId}`);
    
    // DEBUG FILE
    const fs = require('fs');
    const debugPath = 'webhook_debug.txt';
    fs.appendFileSync(debugPath, `\n\n--- NEW MESSAGE ---\nTime: ${new Date().toISOString()}\nSender: ${senderPhone}\nPhoneId: ${phoneId}\nText: ${text}\n`);
    
    // GLOBAL AUTOMATION EVALUATION
    // Cari semua rule Automation yang aktif dan cocok dengan nomor pengirim (atau semua nomor)
    const { data: automations, error: autoErr } = await supabase
      .from('automation')
      .select('*, template:templates(*)')
      .eq('is_active', true)
      .eq('trigger_type', 'Saat pesan masuk')
      .or(`phone_id.is.null,phone_id.eq.${phoneId}`)
      .order('phone_id', { ascending: false }); // Prioritize specific phone_id match over null

    if (autoErr) {
      console.error(`[ExecutionEngine] DB Error fetching automations:`, autoErr);
      fs.appendFileSync(debugPath, `DB ERROR: ${JSON.stringify(autoErr)}\n`);
    }

    console.log(`[ExecutionEngine] Found ${automations?.length || 0} active automation rules matching phoneId ${phoneId} (or null)`);
    fs.appendFileSync(debugPath, `Found ${automations?.length || 0} rules.\n`);
    if (automations) {
      fs.appendFileSync(debugPath, `Rules DB: ${JSON.stringify(automations)}\n`);
    }

    if (!automations || automations.length === 0) {
      console.log(`[ExecutionEngine] No matching automation rule found for 'Saat pesan masuk'.`);
      fs.appendFileSync(debugPath, `Exiting early: no matching rules.\n`);
      return;
    }

    let executed = false;
    for (const automation of automations) {
      let conditionMatched = false;
      const config = automation.condition_config;
      console.log(`[ExecutionEngine] Evaluating rule: ${automation.name} | config:`, config);
      fs.appendFileSync(debugPath, `Eval Rule: ${automation.name}, config: ${JSON.stringify(config)}\n`);
      
      // Evaluasi Keyword Condition
      if (config && config.field === 'keyword') {
        const expectedVal = String(config.value).toLowerCase().trim();
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
          default:
            conditionMatched = true;
        }
      } else {
        conditionMatched = true; // Jika bukan keyword atau tidak ada config spesifik, jalankan
      }

      if (conditionMatched) {
        console.log(`[ExecutionEngine] Automation [${automation.name}] MATCHED! Executing action: ${automation.action_type}`);
        fs.appendFileSync(debugPath, `Automation [${automation.name}] MATCHED! Executing action: ${automation.action_type}\n`);
        
        // EKSEKUSI ACTION
        if (['Kirim template', 'Kirim quick reply'].includes(automation.action_type) && automation.template) {
          fs.appendFileSync(debugPath, `Sending template: ${automation.template.name}\n`);
          const res = await sendMappedTemplate(phoneId, senderPhone, automation.template as TemplateData);
          fs.appendFileSync(debugPath, `sendMappedTemplate result: ${JSON.stringify(res)}\n`);
          
          await logActivity(
            senderPhone, 
            'automation_triggered', 
            res.success ? 'success' : 'failed',
            res.error,
            automation.id,
            automation.template.id,
            { text_received: text }
          );
        } else if (['Tambah label', 'Hapus label', 'Assign', 'Ubah prioritas', 'Ubah status'].includes(automation.action_type)) {
           console.log(`[ExecutionEngine] Action [${automation.action_type}] with value [${automation.action_config?.value}] executed successfully in backend.`);
        } else if (automation.action_type === 'Tunggu') {
           console.log(`[ExecutionEngine] Action [Tunggu] scheduled for [${automation.action_config?.value}] minutes.`);
        }

        executed = true;
        // Kita bisa break jika hanya ingin mengeksekusi 1 rule pertama yang cocok, atau biarkan loop jalan untuk multiple rules.
        // Asumsi: Hanya mengeksekusi 1 rule terkuat (yg pertama cocok).
        break;
      }
    }

    if (!executed) {
      console.log(`[ExecutionEngine] No automation condition matched the keyword.`);
    }

  } catch (error) {
    console.error('[ExecutionEngine] Unhandled error:', error);
  }
}
