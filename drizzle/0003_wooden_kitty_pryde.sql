CREATE TYPE "public"."dsar_request_type" AS ENUM('access', 'deletion', 'correction', 'portability', 'opt_out');--> statement-breakpoint
CREATE TYPE "public"."dsar_status" AS ENUM('intake', 'verifying', 'in_progress', 'completed', 'denied');--> statement-breakpoint
CREATE TABLE "dsar_checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"done" boolean DEFAULT false NOT NULL,
	"done_at" timestamp with time zone,
	"done_by" uuid
);
--> statement-breakpoint
CREATE TABLE "dsar_checklist_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"request_type" "dsar_request_type" NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dsar_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dsar_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"requester_name" text NOT NULL,
	"requester_email" text NOT NULL,
	"request_type" "dsar_request_type" NOT NULL,
	"status" "dsar_status" DEFAULT 'intake' NOT NULL,
	"governing_regulation_acronym" text,
	"governing_regulation_name" text,
	"sla_days" integer,
	"sla_is_business_days" boolean DEFAULT false NOT NULL,
	"sla_due_at" timestamp with time zone,
	"identity_verified" boolean DEFAULT false NOT NULL,
	"identity_verified_at" timestamp with time zone,
	"identity_verified_by" uuid,
	"owner" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'internal' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "dsar_checklist_items" ADD CONSTRAINT "dsar_checklist_items_request_id_dsar_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."dsar_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_checklist_items" ADD CONSTRAINT "dsar_checklist_items_done_by_users_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_checklist_templates" ADD CONSTRAINT "dsar_checklist_templates_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_events" ADD CONSTRAINT "dsar_events_request_id_dsar_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."dsar_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_events" ADD CONSTRAINT "dsar_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_events" ADD CONSTRAINT "dsar_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_requests" ADD CONSTRAINT "dsar_requests_identity_verified_by_users_id_fk" FOREIGN KEY ("identity_verified_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;