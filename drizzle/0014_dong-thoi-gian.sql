CREATE TABLE "book_covers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"round_id" uuid,
	"cover" text NOT NULL,
	"cover_media_id" uuid,
	CONSTRAINT "book_covers_round_id_unique" UNIQUE("round_id"),
	CONSTRAINT "book_covers_cover" CHECK ("book_covers"."cover" in ('nui-xa', 'khom-truc', 'trang-nuoc', 'chim-bay', 'hoa-dao', 'doi-chim', 'thuyen-trang', 'cau-go', 'doi-thong', 'meo-mai'))
);
--> statement-breakpoint
CREATE TABLE "book_tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"round_id" uuid,
	"youtube_id" text,
	CONSTRAINT "book_tracks_round_id_unique" UNIQUE("round_id"),
	CONSTRAINT "book_tracks_youtube_id" CHECK ("book_tracks"."youtube_id" is null or "book_tracks"."youtube_id" ~ '^[A-Za-z0-9_-]{11}$')
);
--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "cover" text;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "cover_media_id" uuid;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "youtube_id" text;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "drop_track" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "book_covers" ADD CONSTRAINT "book_covers_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_covers" ADD CONSTRAINT "book_covers_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_covers" ADD CONSTRAINT "book_covers_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_tracks" ADD CONSTRAINT "book_tracks_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_tracks" ADD CONSTRAINT "book_tracks_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_covers_book_idx" ON "book_covers" USING btree ("book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "book_covers_mo_dau_idx" ON "book_covers" USING btree ("book_id") WHERE "book_covers"."round_id" is null;--> statement-breakpoint
CREATE INDEX "book_tracks_book_idx" ON "book_tracks" USING btree ("book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "book_tracks_mo_dau_idx" ON "book_tracks" USING btree ("book_id") WHERE "book_tracks"."round_id" is null;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_cover_media_id_media_id_fk" FOREIGN KEY ("cover_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_cover" CHECK ("drafts"."cover" is null or "drafts"."cover" in ('nui-xa', 'khom-truc', 'trang-nuoc', 'chim-bay', 'hoa-dao', 'doi-chim', 'thuyen-trang', 'cau-go', 'doi-thong', 'meo-mai'));--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_cover_media" CHECK ("drafts"."cover_media_id" is null or "drafts"."cover" is not null);--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_youtube_id" CHECK ("drafts"."youtube_id" is null or "drafts"."youtube_id" ~ '^[A-Za-z0-9_-]{11}$');--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_drop_track" CHECK ("drafts"."drop_track" = false or "drafts"."youtube_id" is null);