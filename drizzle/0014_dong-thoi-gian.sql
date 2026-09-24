-- Bia va nhac thanh hai dong thoi gian. drizzle-kit migrate goi migrator cua drizzle-orm, va migrator do dat TAT CA
-- migration dang cho vao MOT giao dich chung: mot buoc kiem duoi RAISE thi ca lan migrate huy, database giu nguyen nhu
-- truoc. Phan chuyen du lieu duoc viet them vao cuoi tep sinh tu schema.ts: moi cuon dang co phai ra dung mot o bia
-- MO DAU mang y nguyen bia hom nay, va o nhac chi sinh cho cuon dang co nhac, de nguoi dung khong thay gi khac di cho
-- toi lan viet tiep ke sau.
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
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_drop_track" CHECK ("drafts"."drop_track" = false or "drafts"."youtube_id" is null);--> statement-breakpoint
-- Moi cuon ra dung mot o bia mo dau; cuon khong nhac thi khong ra o nhac nao, vi "khong co o" moi la chua bao gio co
-- nhac, con mot o mang youtube_id null la o GO NHAC.
INSERT INTO "book_covers" ("book_id", "round_id", "cover", "cover_media_id")
SELECT "id", NULL, "cover", "cover_media_id" FROM "books";--> statement-breakpoint
INSERT INTO "book_tracks" ("book_id", "round_id", "youtube_id")
SELECT "id", NULL, "youtube_id" FROM "books" WHERE "youtube_id" IS NOT NULL;--> statement-breakpoint
-- Kiem sau khi chep: sai mot cho la huy ca migration. Thong diep chi co so dem, khong co du lieu nao.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM "books" b WHERE NOT EXISTS (SELECT 1 FROM "book_covers" c WHERE c."book_id" = b."id");
  IF n > 0 THEN
    RAISE EXCEPTION 'dong-thoi-gian: % cuon khong co o bia mo dau', n;
  END IF;

  SELECT count(*) INTO n FROM "book_covers";
  IF n <> (SELECT count(*) FROM "books") THEN
    RAISE EXCEPTION 'dong-thoi-gian: co % o bia ma co % cuon', n, (SELECT count(*) FROM "books");
  END IF;

  SELECT count(*) INTO n FROM "book_covers" c
  JOIN "books" b ON b."id" = c."book_id"
  WHERE c."cover" IS DISTINCT FROM b."cover" OR c."cover_media_id" IS DISTINCT FROM b."cover_media_id";
  IF n > 0 THEN
    RAISE EXCEPTION 'dong-thoi-gian: % o bia lech gia tri cua cuon', n;
  END IF;

  -- Anh bia cua o phai la dong media loai bia va DA thuoc dung cuon do. Bia cho gan (book_id null) ma mot cuon dang tro
  -- toi cung bi tu choi: don rac media chi giu bia da thuoc mot cuon hoac dang nam trong mot o, ma o day o bia moi chua
  -- ton tai luc dong media duoc xet lan truoc; de no qua thi khoa ngoai set null se lam o bia mat anh vinh vien, khong
  -- mot loi nao. Dung ca lan deploy de nguoi van hanh gan anh vao cuon truoc, hon la mat anh mot ngay sau.
  SELECT count(*) INTO n FROM "book_covers" c
  JOIN "media" m ON m."id" = c."cover_media_id"
  WHERE m."kind" <> 'bia' OR m."book_id" IS DISTINCT FROM c."book_id";
  IF n > 0 THEN
    RAISE EXCEPTION 'dong-thoi-gian: % o bia tro toi anh khong phai bia cua cuon', n
      USING HINT = 'Xem tung dong bang: SELECT c.id, c.book_id, c.cover_media_id, m.kind, m.book_id FROM book_covers c JOIN media m ON m.id = c.cover_media_id WHERE m.kind <> ''bia'' OR m.book_id IS DISTINCT FROM c.book_id; Sua du lieu cu roi chay lai migration.';
  END IF;

  SELECT count(*) INTO n FROM "book_tracks";
  IF n <> (SELECT count(*) FROM "books" WHERE "youtube_id" IS NOT NULL) THEN
    RAISE EXCEPTION 'dong-thoi-gian: co % o nhac ma co % cuon co nhac', n, (SELECT count(*) FROM "books" WHERE "youtube_id" IS NOT NULL);
  END IF;

  SELECT count(*) INTO n FROM "book_tracks" t
  JOIN "books" b ON b."id" = t."book_id"
  WHERE t."youtube_id" IS DISTINCT FROM b."youtube_id";
  IF n > 0 THEN
    RAISE EXCEPTION 'dong-thoi-gian: % o nhac lech ma video cua cuon', n;
  END IF;
END $$;