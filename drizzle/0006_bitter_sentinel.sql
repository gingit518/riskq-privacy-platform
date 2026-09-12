CREATE TYPE "public"."tracking_category" AS ENUM('strictly_necessary', 'functional', 'analytics', 'advertising', 'social_media', 'other');--> statement-breakpoint
CREATE TYPE "public"."tracking_party" AS ENUM('first_party', 'third_party');--> statement-breakpoint
CREATE TABLE "tracking_technologies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" text NOT NULL,
	"purpose" text DEFAULT '' NOT NULL,
	"category" "tracking_category" DEFAULT 'other' NOT NULL,
	"party" "tracking_party" DEFAULT 'third_party' NOT NULL,
	"retention" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "tracking_technologies" ADD CONSTRAINT "tracking_technologies_org_id_orgs_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."orgs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracking_technologies" ADD CONSTRAINT "tracking_technologies_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;