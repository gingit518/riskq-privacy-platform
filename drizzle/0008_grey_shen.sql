ALTER TABLE "dsar_requests" ADD COLUMN IF NOT EXISTS "owner_id" uuid;--> statement-breakpoint
ALTER TABLE "org_obligations" ADD COLUMN IF NOT EXISTS "owner_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_obligations" ADD CONSTRAINT "org_obligations_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
