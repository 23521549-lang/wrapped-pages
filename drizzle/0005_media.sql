CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"book_id" uuid,
	"kind" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"duration_ms" integer,
	"peaks" jsonb,
	"store_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_store_key_unique" UNIQUE("store_key"),
	CONSTRAINT "media_kind" CHECK ("media"."kind" in ('anh', 'ghi-am', 'bia')),
	CONSTRAINT "media_sach" CHECK ("media"."book_id" is not null or "media"."kind" = 'bia'),
	CONSTRAINT "media_bytes" CHECK ("media"."bytes" between 1 and (case when "media"."kind" = 'ghi-am' then 2097152 else 1048576 end)),
	CONSTRAINT "media_anh" CHECK ("media"."kind" = 'ghi-am' or ("media"."mime" in ('image/webp', 'image/jpeg') and "media"."width" is not null and "media"."height" is not null and "media"."width" between 1 and 1200 and "media"."height" between 1 and 1600 and "media"."duration_ms" is null and "media"."peaks" is null)),
	CONSTRAINT "media_bia" CHECK ("media"."kind" <> 'bia' or "media"."width" * 3 = "media"."height" * 5),
	CONSTRAINT "media_ghi_am" CHECK ("media"."kind" <> 'ghi-am' or ("media"."mime" in ('audio/webm', 'audio/mp4') and "media"."width" is null and "media"."height" is null and "media"."duration_ms" is not null and "media"."duration_ms" between 1 and 180000 and "media"."peaks" is not null and case when jsonb_typeof("media"."peaks") = 'array' then jsonb_array_length("media"."peaks") = 48 and not jsonb_path_exists("media"."peaks", '$[*] ? (@.type() != "number" || @ < 0 || @ > 100 || @.floor() != @)') else false end)),
	CONSTRAINT "media_store_key" CHECK ("media"."store_key" ~ '^(cho|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})[/][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}[.](webp|jpg|webm|m4a)$')
);
--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "cover_media_id" uuid;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_accounts_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_book_idx" ON "media" USING btree ("book_id");--> statement-breakpoint
CREATE INDEX "media_owner_created_idx" ON "media" USING btree ("owner_id","created_at");--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;