-- Memungkinkan webhook server membaca hanya rule auto reply aktif ketika deployment
-- belum memiliki SUPABASE_SERVICE_ROLE_KEY. Mutasi tabel tetap khusus admin login.

ALTER TABLE public.auto_reply ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Webhook reads active auto replies" ON public.auto_reply;
CREATE POLICY "Webhook reads active auto replies"
ON public.auto_reply
FOR SELECT
TO anon
USING (is_active = TRUE);

DROP POLICY IF EXISTS "Webhook reads active templates" ON public.templates;
CREATE POLICY "Webhook reads active templates"
ON public.templates
FOR SELECT
TO anon
USING (is_active = TRUE);

