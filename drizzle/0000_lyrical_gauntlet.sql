DO $$ BEGIN
 CREATE TYPE "public"."user_role" AS ENUM('admin', 'contributor', 'viewer');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"created_by" uuid NOT NULL,
	"revenue" numeric(14, 2) DEFAULT '0' NOT NULL,
	"employees" integer DEFAULT 0 NOT NULL,
	"consumers" integer DEFAULT 0 NOT NULL,
	"data_sale" numeric(5, 2) DEFAULT '0' NOT NULL,
	"industry" text DEFAULT '' NOT NULL,
	"states" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"intl" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"vendor_countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"ai_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"marketing_channels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "org_regulation_scope" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"org_profile_id" uuid NOT NULL,
	"regulation_set_id" uuid NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"results" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "orgs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "regulation_sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_label" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_profiles" ADD CONSTRAINT "org_profiles_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_profiles" ADD CONSTRAINT "org_profiles_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_regulation_scope" ADD CONSTRAINT "org_regulation_scope_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_regulation_scope" ADD CONSTRAINT "org_regulation_scope_org_profile_id_org_profiles_id_fk" FOREIGN KEY ("org_profile_id") REFERENCES "public"."org_profiles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "org_regulation_scope" ADD CONSTRAINT "org_regulation_scope_regulation_set_id_regulation_sets_id_fk" FOREIGN KEY ("regulation_set_id") REFERENCES "public"."regulation_sets"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "users" ADD CONSTRAINT "users_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "orgs_slug_idx" ON "orgs" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "regulation_sets_version_idx" ON "regulation_sets" USING btree ("version_label");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "users_email_idx" ON "users" USING btree ("email");