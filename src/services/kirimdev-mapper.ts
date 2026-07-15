import { sendTextMessage, sendButtonMessage, sendListMessage, sendMediaMessage, sendTemplateMessage, sendCtaUrlMessage } from '@/lib/whatsapp/kirimdev-client';

export interface TemplateData {
  id: string;
  name: string;
  type: 'text' | 'image' | 'video' | 'document' | 'reply_button' | 'url_button' | 'list';
  header?: string | null;
  body: string;
  footer?: string | null;
  media_url?: string | null;
  buttons?: any[];
  sections?: any[];
}

/**
 * Menerjemahkan format tabel `templates` menjadi payload Kirim.dev API yang sesuai.
 * @param phoneId Phone ID pengirim (Kirim.dev)
 * @param to Nomor tujuan (format 628xxx)
 * @param template Data template dari database
 */
export async function sendMappedTemplate(phoneId: string, to: string, template: TemplateData): Promise<{ success: boolean; error?: string }> {
  try {
    switch (template.type) {
      case 'text': {
        const textBody = [template.header, template.body, template.footer].filter(Boolean).join('\n\n');
        return await sendTextMessage(phoneId, to, textBody);
      }
      case 'image':
      case 'video':
      case 'document':
        if (!template.media_url) {
          return { success: false, error: 'Media URL is missing for media template' };
        }
        return await sendMediaMessage(phoneId, to, template.type, template.media_url, template.body);

      case 'reply_button': {
        if (!template.buttons || template.buttons.length === 0) {
          return { success: false, error: 'Buttons are missing for reply_button template' };
        }
        
        let headerObj: any = undefined;
        if (template.media_url) {
          const ext = template.media_url.split('.').pop()?.toLowerCase() || '';
          const mediaType = ['mp4', 'avi', 'mov'].includes(ext) ? 'video' : ['pdf', 'doc', 'docx'].includes(ext) ? 'document' : 'image';
          headerObj = { type: mediaType, link: template.media_url };
        } else if (template.header) {
          headerObj = { type: 'text', text: template.header };
        }
        
        const formattedButtons = template.buttons.map(btn => ({
          id: btn.payload || btn.title || btn.label,
          title: btn.title || btn.label
        })).slice(0, 3);
        
        return await sendButtonMessage(
          phoneId, 
          to, 
          template.body, 
          formattedButtons,
          headerObj,
          template.footer || undefined
        );
      }
      case 'url_button':
        if (!template.buttons || template.buttons.length === 0) {
          return { success: false, error: 'Buttons are missing for url_button template' };
        }

        let headerUrlObj: any = undefined;
        if (template.media_url) {
          const ext = template.media_url.split('.').pop()?.toLowerCase() || '';
          const mediaType = ['mp4', 'avi', 'mov'].includes(ext) ? 'video' : ['pdf', 'doc', 'docx'].includes(ext) ? 'document' : 'image';
          headerUrlObj = { type: mediaType, link: template.media_url };
        } else if (template.header) {
          headerUrlObj = { type: 'text', text: template.header };
        }

        const btnUrl = template.buttons[0]; // cta_url only supports 1 button natively
        return await sendCtaUrlMessage(
          phoneId,
          to,
          template.body,
          btnUrl.title || btnUrl.label || 'Link',
          btnUrl.url || 'https://google.com',
          headerUrlObj,
          template.footer || undefined
        );

      case 'list': {
        if (!template.sections || template.sections.length === 0) {
          return { success: false, error: 'Sections are missing for list template' };
        }

        let headerObj: any = undefined;
        if (template.media_url) {
          const ext = template.media_url.split('.').pop()?.toLowerCase() || '';
          const mediaType = ['mp4', 'avi', 'mov'].includes(ext) ? 'video' : ['pdf', 'doc', 'docx'].includes(ext) ? 'document' : 'image';
          headerObj = { type: mediaType, link: template.media_url };
        } else if (template.header) {
          headerObj = { type: 'text', text: template.header };
        }

        return await sendListMessage(
          phoneId,
          to,
          template.body,
          'Pilihan', // Default button text
          template.sections,
          headerObj,
          template.footer || undefined
        );
      }

      default:
        // Coba kirim sebagai pre-approved Meta Template jika tipenya unknown
        return await sendTemplateMessage(phoneId, to, template.name, 'id', []);
    }
  } catch (error: any) {
    console.error('[KirimDevMapper] Error sending mapped template:', error);
    return { success: false, error: error.message };
  }
}
