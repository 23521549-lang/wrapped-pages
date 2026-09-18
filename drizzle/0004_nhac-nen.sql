ALTER TABLE "accounts" ADD COLUMN "music_muted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "youtube_id" text;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_youtube_id" CHECK ("books"."youtube_id" is null or "books"."youtube_id" ~ '^[A-Za-z0-9_-]{11}$');