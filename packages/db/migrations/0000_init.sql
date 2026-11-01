CREATE TYPE "public"."image_status" AS ENUM('pending', 'stored', 'failed');--> statement-breakpoint
CREATE TYPE "public"."part_status" AS ENUM('in_stock', 'reserved', 'sold', 'returned', 'written_off');--> statement-breakpoint
CREATE TYPE "public"."sync_kind" AS ENUM('full', 'incremental');--> statement-breakpoint
CREATE TYPE "public"."sync_status" AS ENUM('running', 'succeeded', 'failed');--> statement-breakpoint
CREATE TABLE "channels" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "channels" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_url" text NOT NULL,
	"status" "image_status" DEFAULT 'pending' NOT NULL,
	"sha256" text,
	"storage_key" text,
	"content_type" text,
	"bytes" integer,
	"width" integer,
	"height" integer,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"last_error" text,
	"stored_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "part_images" (
	"part_id" uuid NOT NULL,
	"image_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	CONSTRAINT "part_images_part_id_position_pk" PRIMARY KEY("part_id","position")
);
--> statement-breakpoint
ALTER TABLE "part_images" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "part_listings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"part_id" uuid NOT NULL,
	"channel_id" text NOT NULL,
	"external_id" text NOT NULL,
	"external_updated_at" timestamp,
	"raw" jsonb NOT NULL,
	"content_hash" text NOT NULL,
	"last_seen_run_id" integer,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"removed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "part_listings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "parts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"manufacturer_code" text,
	"visible_code" text,
	"other_code" text,
	"notes" text,
	"internal_notes" text,
	"price" numeric(12, 2),
	"currency" text,
	"quality" smallint,
	"status" "part_status" NOT NULL,
	"rrr_category_id" integer,
	"rrr_car_id" integer,
	"listed_at" timestamp,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "parts" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "sync_runs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"channel_id" text NOT NULL,
	"kind" "sync_kind" NOT NULL,
	"status" "sync_status" DEFAULT 'running' NOT NULL,
	"cursor" text,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "sync_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "part_images" ADD CONSTRAINT "part_images_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_images" ADD CONSTRAINT "part_images_image_id_images_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."images"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_listings" ADD CONSTRAINT "part_listings_part_id_parts_id_fk" FOREIGN KEY ("part_id") REFERENCES "public"."parts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "part_listings" ADD CONSTRAINT "part_listings_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_runs" ADD CONSTRAINT "sync_runs_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "images_source_url_uq" ON "images" USING btree ("source_url");--> statement-breakpoint
CREATE INDEX "images_pending_idx" ON "images" USING btree ("created_at") WHERE "images"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "part_images_image_idx" ON "part_images" USING btree ("image_id");--> statement-breakpoint
CREATE UNIQUE INDEX "part_listings_channel_external_uq" ON "part_listings" USING btree ("channel_id","external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "part_listings_part_channel_uq" ON "part_listings" USING btree ("part_id","channel_id");--> statement-breakpoint
CREATE INDEX "part_listings_external_updated_idx" ON "part_listings" USING btree ("channel_id","external_updated_at");--> statement-breakpoint
CREATE INDEX "parts_status_idx" ON "parts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "parts_manufacturer_code_idx" ON "parts" USING btree ("manufacturer_code");--> statement-breakpoint
CREATE INDEX "parts_rrr_category_idx" ON "parts" USING btree ("rrr_category_id");--> statement-breakpoint
CREATE INDEX "sync_runs_channel_kind_idx" ON "sync_runs" USING btree ("channel_id","kind","started_at");