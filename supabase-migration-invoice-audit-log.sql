-- Audit invoice di level database agar pembuatan/update invoice dari panel admin
-- maupun dari webhook pembayaran selalu terlihat di Activity & API Logs.

CREATE OR REPLACE FUNCTION log_invoice_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    event_name TEXT;
    audit_customer TEXT;
    audit_message TEXT;
BEGIN
    IF TG_OP = 'UPDATE'
       AND (to_jsonb(NEW) - 'updated_at') IS NOT DISTINCT FROM (to_jsonb(OLD) - 'updated_at') THEN
        RETURN NEW;
    END IF;

    audit_customer := COALESCE(NULLIF(NEW.client_phone, ''), 'invoice:' || NEW.invoice_number);

    IF TG_OP = 'INSERT' THEN
        event_name := 'invoice.created';
        audit_message := 'Invoice ' || NEW.invoice_number || ' dibuat dengan status ' || COALESCE(NEW.status, '-');
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
        event_name := 'invoice.status_changed';
        audit_message := 'Status invoice ' || NEW.invoice_number || ': ' || COALESCE(OLD.status, '-') || ' → ' || COALESCE(NEW.status, '-');
    ELSE
        event_name := 'invoice.updated';
        audit_message := 'Invoice ' || NEW.invoice_number || ' diperbarui';
    END IF;

    INSERT INTO logs (customer, event_type, status, message, metadata)
    VALUES (
        audit_customer,
        event_name,
        'success',
        audit_message,
        jsonb_build_object(
            'invoice_id', NEW.id,
            'invoice_number', NEW.invoice_number,
            'invoice_status', NEW.status,
            'total', NEW.total,
            'source', CASE WHEN TG_OP = 'INSERT' THEN 'database_insert' ELSE 'database_update' END
        )
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS audit_invoice_activity ON invoices;
CREATE TRIGGER audit_invoice_activity
AFTER INSERT OR UPDATE ON invoices
FOR EACH ROW EXECUTE FUNCTION log_invoice_activity();

CREATE INDEX IF NOT EXISTS idx_logs_invoice_activity
    ON logs (event_type, created_at DESC)
    WHERE event_type LIKE 'invoice.%';
