DO $$ BEGIN
 CREATE TYPE "public"."control_status" AS ENUM('not_implemented', 'partial', 'implemented');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."obligation_status" AS ENUM('not_started', 'in_progress', 'done', 'not_applicable');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "controls_library" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"framework" text NOT NULL,
	"function" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"regulation_groups_tag" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org_controls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"control_id" uuid NOT NULL,
	"status" "control_status" DEFAULT 'not_implemented' NOT NULL,
	"evidence_note" text DEFAULT '' NOT NULL,
	"last_tested_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org_obligations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"regulation_acronym" text NOT NULL,
	"regulation_name" text NOT NULL,
	"obligation_text" text NOT NULL,
	"status" "obligation_status" DEFAULT 'not_started' NOT NULL,
	"owner" text DEFAULT '' NOT NULL,
	"due_date" timestamp with time zone,
	"evidence_note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_controls" ADD CONSTRAINT "org_controls_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_controls" ADD CONSTRAINT "org_controls_control_id_controls_library_id_fk" FOREIGN KEY ("control_id") REFERENCES "public"."controls_library"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_obligations" ADD CONSTRAINT "org_obligations_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "controls_library_code_idx" ON "controls_library" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_controls_dedupe_idx" ON "org_controls" USING btree ("org_id","control_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "org_obligations_dedupe_idx" ON "org_obligations" USING btree ("org_id","regulation_acronym","obligation_text");