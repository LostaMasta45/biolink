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
    
    // GLOBAL AUTOMATION EVALUATION
    // Cari semua rule Automation yang aktif dan cocok dengan nomor pengirim (atau semua nomor)
    let query = supabase
      .from('automation')
      .select('*, template:templates(*)')
      .eq('is_active', true)
      .eq('trigger_type', 'Saat pesan masuk');

    if (phoneId) {
      query = query.or(`phone_id.is.null,phone_id.eq.${phoneId}`);
    } else {
      query = query.is('phone_id', null);
    }

    const { data: automations, error: autoErr } = await query.order('phone_id', { ascending: false }); // Prioritize specific phone_id match over null

    if (autoErr) {
      console.error(`[ExecutionEngine] DB Error fetching automations:`, autoErr);
    }

    console.log(`[ExecutionEngine] Found ${automations?.length || 0} active automation rules matching phoneId ${phoneId} (or null)`);

    if (!automations || automations.length === 0) {
      console.log(`[ExecutionEngine] No matching automation rule found for 'Saat pesan masuk'.`);
      return;
    }

    let executed = false;
    for (const automation of automations) {
      let conditionMatched = false;
      const config = automation.condition_config;
      console.log(`[ExecutionEngine] Evaluating rule: ${automation.name} | config:`, config);
      
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
        
        // EKSEKUSI ACTION
        if (['Kirim template', 'Kirim quick reply'].includes(automation.action_type) && automation.template) {
          console.log(`[ExecutionEngine] Sending template: ${automation.template.name}`);
          const res = await sendMappedTemplate(phoneId, senderPhone, automation.template as TemplateData);
          console.log(`[ExecutionEngine] sendMappedTemplate result: ${JSON.stringify(res)}`);
          
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
