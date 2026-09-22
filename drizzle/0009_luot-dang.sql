-- Luot dang. drizzle-kit migrate chay moi migration dang cho trong MOT giao dich: mot buoc kiem ben duoi RAISE thi
-- ca migration huy, database giu nguyen nhu truoc. Viet tay vi phai gan luot cho du lieu cu giua luc them cot va luc
-- siet rang buoc; ten rang buoc va chi muc dung y nhu drizzle-kit sinh tu schema.ts.
CREATE TABLE "rounds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"edited_at" timestamp with time zone,
	CONSTRAINT "rounds_edited_at" CHECK ("rounds"."edited_at" is null or "rounds"."edited_at" >= "rounds"."published_at")
);
--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rounds_book_idx" ON "rounds" USING btree ("book_id","published_at");--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "round_id" uuid;--> statement-breakpoint
ALTER TABLE "seals" ADD COLUMN "round_id" uuid;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "round_id" uuid;--> statement-breakpoint
-- Moi nhom (book_id, published_at) la mot luot: publishDraft chen moi to cua mot lan dang voi cung mot now.
INSERT INTO "rounds" ("book_id", "published_at", "edited_at")
SELECT "book_id", "published_at", max("edited_at") FROM "pages" GROUP BY "book_id", "published_at";--> statement-breakpoint
UPDATE "pages" SET "round_id" = r."id"
FROM "rounds" r
WHERE r."book_id" = "pages"."book_id" AND r."published_at" = "pages"."published_at";--> statement-breakpoint
-- Niem phong va su kien lay luot chua to dau cua chung.
UPDATE "seals" SET "round_id" = p."round_id"
FROM "pages" p
WHERE p."book_id" = "seals"."book_id" AND p."position" = "seals"."first_position";--> statement-breakpoint
UPDATE "activity" SET "round_id" = p."round_id"
FROM "pages" p
WHERE "activity"."kind" <> 'doi-mat-khau' AND p."book_id" = "activity"."book_id" AND p."position" = "activity"."first_position";--> statement-breakpoint
-- Kiem truoc khi siet: sai mot cho la huy ca migration. Thong diep chi co so dem, khong co du lieu nao.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM "pages" WHERE "round_id" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'luot-dang: % to khong gan duoc luot', n;
  END IF;

  SELECT count(*) INTO n FROM (
    SELECT "round_id" FROM "pages" GROUP BY "round_id" HAVING max("position") - min("position") + 1 <> count(*)
  ) x;
  IF n > 0 THEN
    RAISE EXCEPTION 'luot-dang: % luot co to khong lien nhau', n;
  END IF;

  SELECT count(*) INTO n
  FROM "seals" s
  LEFT JOIN (SELECT "round_id", min("position") AS dau, max("position") AS cuoi FROM "pages" GROUP BY "round_id") k
    ON k."round_id" = s."round_id"
  WHERE s."round_id" IS NULL OR k.dau IS DISTINCT FROM s."first_position" OR k.cuoi IS DISTINCT FROM s."last_position";
  IF n > 0 THEN
    RAISE EXCEPTION 'luot-dang: % niem phong khong phu dung tron mot luot', n;
  END IF;

  SELECT count(*) INTO n FROM (SELECT "round_id" FROM "seals" GROUP BY "round_id" HAVING count(*) > 1) x;
  IF n > 0 THEN
    RAISE EXCEPTION 'luot-dang: % luot co hon mot niem phong', n;
  END IF;

  SELECT count(*) INTO n
  FROM "activity" a
  LEFT JOIN (SELECT "round_id", min("position") AS dau, max("position") AS cuoi FROM "pages" GROUP BY "round_id") k
    ON k."round_id" = a."round_id"
  WHERE a."kind" <> 'doi-mat-khau'
    AND (a."round_id" IS NULL OR k.dau IS DISTINCT FROM a."first_position" OR k.cuoi IS DISTINCT FROM a."last_position");
  IF n > 0 THEN
    RAISE EXCEPTION 'luot-dang: % su kien khong khop mot luot', n;
  END IF;

  SELECT count(*) INTO n FROM "activity" a JOIN "seals" s ON s."id" = a."seal_id" WHERE a."round_id" IS DISTINCT FROM s."round_id";
  IF n > 0 THEN
    RAISE EXCEPTION 'luot-dang: % su kien lech luot voi niem phong cua no', n;
  END IF;
END $$;--> statement-breakpoint
ALTER TABLE "pages" ALTER COLUMN "round_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "seals" ALTER COLUMN "round_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seals" ADD CONSTRAINT "seals_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pages_round_idx" ON "pages" USING btree ("round_id");--> statement-breakpoint
ALTER TABLE "seals" ADD CONSTRAINT "seals_round_id_unique" UNIQUE("round_id");--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_sach";--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_mat_khau";--> statement-breakpoint
ALTER TABLE "pages" DROP CONSTRAINT "pages_edited_at";--> statement-breakpoint
ALTER TABLE "seals" DROP CONSTRAINT "seals_range";--> statement-breakpoint
DROP INDEX "seals_book_first_idx";--> statement-breakpoint
ALTER TABLE "activity" DROP COLUMN "first_position";--> statement-breakpoint
ALTER TABLE "activity" DROP COLUMN "last_position";--> statement-breakpoint
ALTER TABLE "pages" DROP COLUMN "edited_at";--> statement-breakpoint
ALTER TABLE "seals" DROP COLUMN "first_position";--> statement-breakpoint
ALTER TABLE "seals" DROP COLUMN "last_position";--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_sach" CHECK ("activity"."kind" = 'doi-mat-khau' or ("activity"."book_id" is not null and "activity"."subject_id" is null and "activity"."round_id" is not null));--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_mat_khau" CHECK ("activity"."kind" <> 'doi-mat-khau' or ("activity"."subject_id" is not null and "activity"."subject_id" <> "activity"."actor_id" and "activity"."book_id" is null and "activity"."seal_id" is null and "activity"."round_id" is null and "activity"."shared" = false));
