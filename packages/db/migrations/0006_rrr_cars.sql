CREATE TABLE "rrr_car_models" (
	"id" integer PRIMARY KEY NOT NULL,
	"brand" text NOT NULL,
	"name" text NOT NULL,
	"year_start" smallint,
	"year_end" smallint,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rrr_car_models" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "rrr_cars" (
	"id" integer PRIMARY KEY NOT NULL,
	"model_id" integer,
	"year" smallint,
	"body_type" text,
	"fuel" text,
	"power_kw" smallint,
	"engine_cc" integer,
	"color" text,
	"wheel_drive" text,
	"raw" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rrr_cars" ENABLE ROW LEVEL SECURITY;