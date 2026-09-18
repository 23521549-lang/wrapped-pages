CREATE TABLE "media_objects" (
	"store_key" text PRIMARY KEY NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_objects_store_key" CHECK ("media_objects"."store_key" ~ '^(cho|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[/][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg|webm|m4a)$')
);
--> statement-breakpoint
CREATE TABLE "media_sweeps" (
	"id" integer PRIMARY KEY NOT NULL,
	"ran_at" timestamp with time zone NOT NULL,
	CONSTRAINT "media_sweeps_one" CHECK ("media_sweeps"."id" = 1)
);
