-- Enable RLS for automation and templates
ALTER TABLE "public"."automation" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON "public"."automation" FOR SELECT USING (true);

ALTER TABLE "public"."templates" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON "public"."templates" FOR SELECT USING (true);
