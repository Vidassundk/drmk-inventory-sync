CREATE TABLE "rrr_categories" (
	"id" integer PRIMARY KEY NOT NULL,
	"parent_id" integer,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rrr_categories" ENABLE ROW LEVEL SECURITY;