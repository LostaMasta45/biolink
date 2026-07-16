import {
  sendButtonMessage,
  sendCarouselMessage,
  sendCtaUrlMessage,
  sendListMessage,
  sendMediaMessage,
  sendTextMessage,
  type KirimDevSendContext,
  type KirimDevSendResult,
} from '@/lib/whatsapp/kirimdev-client';
import type { CarouselCard, InteractiveHeaderType, TemplateType } from '@/types/whatsapp-manager';

export interface TemplateData {
  id: string;
  name: string;
  type: TemplateType;
  header_type?: InteractiveHeaderType;
  header?: string | null;
  body: string;
  footer?: string | null;
  media_url?: string | null;
  preview_url?: boolean;
  filename?: string | null;
  list_button_text?: string;
  buttons?: Array<{ id?: string; payload?: string; title?: string; label?: string; url?: string }>;
  sections?: unknown[];
  carousel_cards?: CarouselCard[];
}

type InteractiveHeader = { type: 'text' | 'image' | 'video' | 'document'; text?: string; link?: string };

function buildInteractiveHeader(template: TemplateData): InteractiveHeader | undefined {
  if (template.header_type === 'text' && template.header) return { type: 'text', text: template.header };
  if (template.header_type && ['image', 'video', 'document'].includes(template.header_type) && template.media_url) {
    return { type: template.header_type as 'image' | 'video' | 'document', link: template.media_url };
  }
  return undefined;
}

/** Converts the saved UI model into the exact KirimDev/Meta message payload. */
export async function sendMappedTemplate(
  phoneId: string,
  to: string,
  template: TemplateData,
  context: KirimDevSendContext = {},
): Promise<KirimDevSendResult> {
  try {
    switch (template.type) {
      case 'text':
        return await sendTextMessage(phoneId, to, template.body, context, template.preview_url ?? false);

      case 'image':
      case 'video':
      case 'audio':
      case 'document':
        if (!template.media_url) return { success: false, error: 'URL media belum diisi' };
        return await sendMediaMessage(
          phoneId,
          to,
          template.type,
          template.media_url,
          template.type === 'audio' ? undefined : template.body || undefined,
          context,
          template.type === 'document' ? template.filename || undefined : undefined,
        );

      case 'reply_button': {
        if (!template.buttons?.length) return { success: false, error: 'Minimal satu reply button diperlukan' };
        const buttons = template.buttons.slice(0, 3).map((button, index) => ({
          id: button.id || button.payload || `button_${index + 1}`,
          title: button.title || button.label || `Pilihan ${index + 1}`,
        }));
        return await sendButtonMessage(phoneId, to, template.body, buttons, buildInteractiveHeader(template), template.footer || undefined, context);
      }

      case 'url_button': {
        const button = template.buttons?.[0];
        if (!button?.url) return { success: false, error: 'CTA URL membutuhkan satu tombol dan URL' };
        return await sendCtaUrlMessage(
          phoneId,
          to,
          template.body,
          button.title || button.label || 'Buka link',
          button.url,
          buildInteractiveHeader(template),
          template.footer || undefined,
          context,
        );
      }

      case 'list':
        if (!template.sections?.length) return { success: false, error: 'Minimal satu section list diperlukan' };
        return await sendListMessage(
          phoneId,
          to,
          template.body,
          template.list_button_text || 'Lihat pilihan',
          template.sections,
          template.header_type === 'text' && template.header ? { type: 'text', text: template.header } : undefined,
          template.footer || undefined,
          context,
        );

      case 'carousel':
        if (!template.carousel_cards || template.carousel_cards.length < 2) return { success: false, error: 'Carousel membutuhkan minimal dua card' };
        return await sendCarouselMessage(phoneId, to, template.body, template.carousel_cards.map((card) => ({
          headerType: card.header_type,
          mediaUrl: card.media_url,
          body: card.body,
          actionType: card.action_type,
          buttonId: card.button_id,
          buttonLabel: card.button_label,
          buttonUrl: card.button_url,
        })), context);
    }
  } catch (error: unknown) {
    console.error('[KirimDevMapper] Error sending mapped template:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Template gagal dikirim' };
  }
}
