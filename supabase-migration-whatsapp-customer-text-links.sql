-- Open QRIS/invoice links in the external browser observed on target devices.
-- Safe to run repeatedly. It updates only the templates assigned to the three
-- customer payment notification events and preserves their rule routing/dedupe.

DO $$
DECLARE
    shared_template_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO shared_template_count
    FROM (
        SELECT target_rule.template_id
        FROM notification_rules AS target_rule
        JOIN notification_rules AS any_rule ON any_rule.template_id = target_rule.template_id
        WHERE target_rule.event_key IN (
            'invoice.created.customer',
            'invoice.reminder.customer',
            'payment.paid.customer'
        )
        GROUP BY target_rule.template_id
        HAVING COUNT(any_rule.id) > 1
    ) AS shared_templates;

    IF shared_template_count > 0 THEN
        RAISE EXCEPTION 'Text-link migration stopped: % target template(s) are shared by other notification rules', shared_template_count;
    END IF;
END $$;

UPDATE templates AS template
SET
    type = 'text',
    preview_url = FALSE,
    header = NULL,
    header_type = 'none',
    media_url = NULL,
    buttons = '[]'::JSONB,
    body = CASE notification_rule.event_key
        WHEN 'invoice.created.customer' THEN E'Halo Kak {{customer_name}} 👋\n\nTagihan untuk *{{package_name}}* sebesar *Rp {{amount}}* telah dibuat.\n\nSilakan buka link berikut untuk melihat QRIS dan menyelesaikan pembayaran:\n{{payment_url}}\n\nMohon pastikan nominal dan nama merchant sudah sesuai sebelum melakukan pembayaran.\n\nTerima kasih.\n— Admin InfoLokerJombang'
        WHEN 'invoice.reminder.customer' THEN E'Halo Kak {{customer_name}} 👋\n\nKami mengingatkan bahwa pembayaran QRIS untuk *{{package_name}}* sebesar *Rp {{amount}}* masih menunggu.\n\nSilakan lanjutkan pembayaran melalui link berikut:\n{{payment_url}}\n\nApabila pembayaran telah dilakukan, pesan ini dapat diabaikan.\n\nTerima kasih.\n— Admin InfoLokerJombang'
        WHEN 'payment.paid.customer' THEN E'Halo Kak {{customer_name}} 👋\n\nPembayaran untuk *{{package_name}}* sebesar *Rp {{amount}}* telah kami terima dan terkonfirmasi. ✅\n\nInvoice pembayaran dapat dilihat dan diunduh melalui link berikut:\n{{invoice_url}}\n\nPoster dan pesanan Kakak akan segera kami proses sesuai paket yang dipilih.\n\nTerima kasih atas kepercayaannya.\n— Admin InfoLokerJombang'
        ELSE template.body
    END
FROM notification_rules AS notification_rule
WHERE notification_rule.template_id = template.id
  AND notification_rule.event_key IN (
      'invoice.created.customer',
      'invoice.reminder.customer',
      'payment.paid.customer'
  );

DO $$
DECLARE
    invalid_count INTEGER;
BEGIN
    SELECT COUNT(*)
    INTO invalid_count
    FROM notification_rules AS notification_rule
    JOIN templates AS template ON template.id = notification_rule.template_id
    WHERE notification_rule.event_key IN (
        'invoice.created.customer',
        'invoice.reminder.customer',
        'payment.paid.customer'
    )
      AND (
          template.type <> 'text'
          OR template.preview_url
          OR template.buttons <> '[]'::JSONB
          OR (
              notification_rule.event_key IN ('invoice.created.customer', 'invoice.reminder.customer')
              AND POSITION('{{payment_url}}' IN template.body) = 0
          )
          OR (
              notification_rule.event_key = 'payment.paid.customer'
              AND POSITION('{{invoice_url}}' IN template.body) = 0
          )
      );

    IF invalid_count > 0 THEN
        RAISE EXCEPTION 'Customer payment text-link migration validation failed for % template(s)', invalid_count;
    END IF;
END $$;
