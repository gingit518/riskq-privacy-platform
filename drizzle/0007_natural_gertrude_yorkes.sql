CREATE TYPE "public"."connector_id" AS ENUM('salesforce', 'm365', 'google_drive');--> statement-breakpoint
CREATE TYPE "public"."connector_match_action" AS ENUM('export', 'delete');--> statement-breakpoint
CREATE TYPE "public"."connector_match_decision" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."connector_match_result" AS ENUM('pending', 'succeeded', 'failed', 'blocked_legal_hold');--> statement-breakpoint
CREATE TYPE "public"."connector_run_status" AS ENUM('searching', 'awaiting_approval', 'executing', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "connector_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"connector_id" "connector_id" NOT NULL,
	"account_label" text DEFAULT '' NOT NULL,
	"encrypted_refresh_token" text NOT NULL,
	"connected_by" uuid NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dsar_connector_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"connector_id" "connector_id" NOT NULL,
	"event_type" text NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"actor_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dsar_connector_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"request_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"connector_id" "connector_id" NOT NULL,
	"external_object_type" text NOT NULL,
	"external_record_id" text NOT NULL,
	"snapshot" jsonb NOT NULL,
	"requested_action" "connector_match_action" DEFAULT 'export' NOT NULL,
	"decision" "connector_match_decision" DEFAULT 'pending' NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"result" "connector_match_result" DEFAULT 'pending' NOT NULL,
	"result_detail" text DEFAULT '' NOT NULL,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dsar_connector_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"org_id" uuid NOT NULL,
	"connector_id" "connector_id" NOT NULL,
	"status" "connector_run_status" DEFAULT 'searching' NOT NULL,
	"error_detail" text DEFAULT '' NOT NULL,
	"started_by" uuid NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sub_processors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"contact_email" text DEFAULT '' NOT NULL,
	"data_categories" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "connector_connections" ADD CONSTRAINT "connector_connections_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "connector_connections" ADD CONSTRAINT "connector_connections_connected_by_users_id_fk" FOREIGN KEY ("connected_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_connector_events" ADD CONSTRAINT "dsar_connector_events_request_id_dsar_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."dsar_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_connector_events" ADD CONSTRAINT "dsar_connector_events_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_connector_events" ADD CONSTRAINT "dsar_connector_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_connector_matches" ADD CONSTRAINT "dsar_connector_matches_run_id_dsar_connector_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."dsar_connector_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_connector_matches" ADD CONSTRAINT "dsar_connector_matches_request_id_dsar_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."dsar_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_connector_matches" ADD CONSTRAINT "dsar_connector_matches_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_connector_matches" ADD CONSTRAINT "dsar_connector_matches_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_connector_runs" ADD CONSTRAINT "dsar_connector_runs_request_id_dsar_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."dsar_requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_connector_runs" ADD CONSTRAINT "dsar_connector_runs_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dsar_connector_runs" ADD CONSTRAINT "dsar_connector_runs_started_by_users_id_fk" FOREIGN KEY ("started_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_processors" ADD CONSTRAINT "sub_processors_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sub_processors" ADD CONSTRAINT "sub_processors_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "connector_connections_org_connector_idx" ON "connector_connections" USING btree ("org_id","connector_id");