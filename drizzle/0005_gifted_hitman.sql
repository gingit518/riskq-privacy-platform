CREATE TYPE "public"."dpia_risk_rating" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."dpia_status" AS ENUM('draft', 'completed');--> statement-breakpoint
CREATE TYPE "public"."maturity_level" AS ENUM('not_assessed', 'initial', 'developing', 'defined', 'managed', 'optimized');--> statement-breakpoint
CREATE TYPE "public"."tia_status" AS ENUM('not_started', 'in_progress', 'complete', 'not_required');--> statement-breakpoint
CREATE TYPE "public"."transfer_mechanism" AS ENUM('sccs', 'adequacy_decision', 'bcrs', 'derogation', 'none');--> statement-breakpoint
CREATE TABLE "dpia_assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"status" "dpia_status" DEFAULT 'draft' NOT NULL,
	"answers" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"risk_rating" "dpia_risk_rating",
	"mitigations" text DEFAULT '' NOT NULL,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "international_transfers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"activity_id" uuid,
	"from_jurisdiction" text NOT NULL,
	"to_jurisdiction" text NOT NULL,
	"mechanism" "transfer_mechanism" DEFAULT 'none' NOT NULL,
	"tia_status" "tia_status" DEFAULT 'not_started' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"purpose" text DEFAULT '' NOT NULL,
	"data_categories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"data_subjects" text DEFAULT '' NOT NULL,
	"lawful_basis" text DEFAULT '' NOT NULL,
	"retention_period" text DEFAULT '' NOT NULL,
	"special_category_data" boolean DEFAULT false NOT NULL,
	"large_scale_processing" boolean DEFAULT false NOT NULL,
	"automated_decision_making" boolean DEFAULT false NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_activity_systems" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"activity_id" uuid NOT NULL,
	"system_id" uuid NOT NULL
);
--> statement-breakpoint
ALTER TABLE "evidence_files" ADD COLUMN "transfer_id" uuid;--> statement-breakpoint
ALTER TABLE "org_controls" ADD COLUMN "maturity_level" "maturity_level" DEFAULT 'not_assessed' NOT NULL;--> statement-breakpoint
ALTER TABLE "org_controls" ADD COLUMN "maturity_notes" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "dpia_assessments" ADD CONSTRAINT "dpia_assessments_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_assessments" ADD CONSTRAINT "dpia_assessments_activity_id_processing_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_assessments" ADD CONSTRAINT "dpia_assessments_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dpia_assessments" ADD CONSTRAINT "dpia_assessments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "international_transfers" ADD CONSTRAINT "international_transfers_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "international_transfers" ADD CONSTRAINT "international_transfers_activity_id_processing_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "international_transfers" ADD CONSTRAINT "international_transfers_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activities" ADD CONSTRAINT "processing_activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_systems" ADD CONSTRAINT "processing_activity_systems_activity_id_processing_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."processing_activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_activity_systems" ADD CONSTRAINT "processing_activity_systems_system_id_dsar_systems_id_fk" FOREIGN KEY ("system_id") REFERENCES "public"."dsar_systems"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "dpia_assessments_activity_idx" ON "dpia_assessments" USING btree ("activity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "processing_activity_systems_dedupe_idx" ON "processing_activity_systems" USING btree ("activity_id","system_id");--> statement-breakpoint
ALTER TABLE "evidence_files" ADD CONSTRAINT "evidence_files_transfer_id_international_transfers_id_fk" FOREIGN KEY ("transfer_id") REFERENCES "public"."international_transfers"("id") ON DELETE cascade ON UPDATE no action;