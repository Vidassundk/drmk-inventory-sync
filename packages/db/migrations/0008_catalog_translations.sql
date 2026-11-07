ALTER TABLE "rrr_cars" ADD COLUMN "translations" jsonb;--> statement-breakpoint
ALTER TABLE "rrr_categories" ADD COLUMN "name_en" text;--> statement-breakpoint
ALTER TABLE "rrr_categories" ADD COLUMN "name_ru" text;--> statement-breakpoint
ALTER TABLE "rrr_categories" ADD COLUMN "path_en" text;--> statement-breakpoint
ALTER TABLE "rrr_categories" ADD COLUMN "path_ru" text;