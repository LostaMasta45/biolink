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
    // 1. Cek sesi aktif di tabel bot_sessions
    const { data: session } = await supabase
      .from('bot_sessions')
      .select('*')
      .eq('phone_id', phoneId)
      .eq('sender_phone', senderPhone)
      .single();

    // Jika sedang dalam state bot lama (misal LOWONGAN_AWAIT_AMOUNT), biarkan bot lama yang handle.
    // Kita hanya intercept jika state = 'FLOW_ENGINE' atau tidak ada state (null/baru).
    if (session && session.state && session.state !== 'FLOW_ENGINE') {
      console.log(`[ExecutionEngine] Customer is in legacy state (${session.state}). Ignoring.`);
      return;
    }

    const lowerText = text.toLowerCase().trim();

    // 2. Jika tidak ada sesi FLOW_ENGINE aktif, cek Auto Reply
    if (!session || !session.data?.current_node_id) {
      console.log(`[ExecutionEngine] No active flow session. Checking auto_reply for keyword: ${lowerText}`);
      
      const { data: autoReply } = await supabase
        .from('auto_reply')
        .select('*, template:templates(*)')
        .eq('is_active', true)
        .or(`phone_id.is.null,phone_id.eq.${phoneId}`)
        .ilike('keyword', lowerText)
        .order('phone_id', { ascending: false }) // Prioritize specific match over null
        .limit(1)
        .maybeSingle();

      if (autoReply && autoReply.template) {
        console.log(`[ExecutionEngine] Auto-reply matched! Sending template: ${autoReply.template.name}`);
        
        // Kirim Template
        const res = await sendMappedTemplate(phoneId, senderPhone, autoReply.template as TemplateData);
        
        await logActivity(
          senderPhone, 
          'auto_reply_triggered', 
          res.success ? 'success' : 'failed',
          res.error,
          null,
          autoReply.template.id,
          { keyword: autoReply.keyword }
        );

        // Jika auto-reply terhubung ke flow, mulai flow baru
        if (autoReply.flow_id) {
          const { data: firstNode } = await supabase
            .from('flow_nodes')
            .select('*')
            .eq('flow_id', autoReply.flow_id)
            .order('position', { ascending: true })
            .limit(1)
            .single();

          if (firstNode) {
            await supabase.from('bot_sessions').upsert({
              phone_id: phoneId,
              sender_phone: senderPhone,
              state: 'FLOW_ENGINE',
              data: { flow_id: autoReply.flow_id, current_node_id: firstNode.id }
            });
            console.log(`[ExecutionEngine] Customer enrolled in flow: ${autoReply.flow_id}, node: ${firstNode.id}`);
          }
        }
        return; // Selesai memproses
      }
      
      console.log(`[ExecutionEngine] No matching auto_reply found.`);
      return;
    }

    // 3. Jika ada sesi FLOW_ENGINE aktif, cek Automation Node saat ini
    const currentNodeId = session.data.current_node_id;
    console.log(`[ExecutionEngine] Active session at node: ${currentNodeId}`);

    const { data: currentNode } = await supabase
      .from('flow_nodes')
      .select('*, automation(*, template:templates(*))')
      .eq('id', currentNodeId)
      .single();

    if (!currentNode || !currentNode.automation) {
      console.log(`[ExecutionEngine] Node not found or no automation configured.`);
      return;
    }

    const automation = currentNode.automation;
    
    // Evaluasi Condition
    let conditionMatched = false;
    
    if (!automation.is_active) {
      console.log(`[ExecutionEngine] Automation is inactive.`);
      return;
    }

    if (automation.trigger_type === 'Customer First Message' || automation.trigger_type === 'Customer Reply') {
      const config = automation.condition_config;
      if (config && config.operator) {
        const expectedVal = String(config.value).toLowerCase().trim();
        switch (config.operator) {
          case 'Equals':
            conditionMatched = (lowerText === expectedVal);
            break;
          case 'Contains':
            conditionMatched = lowerText.includes(expectedVal);
            break;
          case 'Not Equals':
            conditionMatched = (lowerText !== expectedVal);
            break;
          default:
            conditionMatched = true; // No specific operator defined
        }
      } else {
        conditionMatched = true; // Jika tidak ada kondisi spesifik, berarti tangkap semua
      }
    }

    if (conditionMatched) {
      console.log(`[ExecutionEngine] Automation condition MATCHED! Executing action: ${automation.action_type}`);
      
      if (automation.action_type === 'Send Template' && automation.template) {
        const res = await sendMappedTemplate(phoneId, senderPhone, automation.template as TemplateData);
        
        await logActivity(
          senderPhone, 
          'automation_triggered', 
          res.success ? 'success' : 'failed',
          res.error,
          automation.id,
          automation.template.id,
          { text_received: text }
        );
      }

      // Lanjut ke node berikutnya jika ada
      if (currentNode.next_node_id) {
        await supabase.from('bot_sessions').update({
          data: { flow_id: currentNode.flow_id, current_node_id: currentNode.next_node_id }
        }).eq('phone_id', phoneId).eq('sender_phone', senderPhone);
        console.log(`[ExecutionEngine] Moved to next node: ${currentNode.next_node_id}`);
      } else {
        // Alur selesai, hapus dari bot_sessions atau reset state
        await supabase.from('bot_sessions').delete()
          .eq('phone_id', phoneId).eq('sender_phone', senderPhone);
        console.log(`[ExecutionEngine] Flow completed. Session cleared.`);
      }
    } else {
      console.log(`[ExecutionEngine] Automation condition NOT matched. Expected: ${automation.condition_config?.value}`);
    }

  } catch (error) {
    console.error('[ExecutionEngine] Unhandled error:', error);
  }
}
