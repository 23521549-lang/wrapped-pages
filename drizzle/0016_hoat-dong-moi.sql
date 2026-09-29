-- Hoat dong moi (dot nam, phan 5a): bay loai su kien, cot mood_id va detail, bang activity_seen (dau Moi) va
-- reading_positions (trang dang doc do). drizzle-kit migrate chay moi migration dang cho trong MOT giao dich chung: mot
-- buoc kiem duoi RAISE thi ca lan migrate huy, database giu nguyen. Phan chuyen du lieu viet them vao cuoi tep sinh tu
-- schema.ts: moi dong Hoat dong da co la DA XEM voi ca hai nguoi, de len ban moi khong co dong cu nao boi dau Moi. Ba
-- CHECK viet lai khong siet them loai cu nao, nen du lieu cu luon qua duoc.
CREATE TABLE "activity_seen" (
	"account_id" uuid NOT NULL,
	"activity_id" uuid NOT NULL,
	"seen_at" timestamp with time zone NOT NULL,
	CONSTRAINT "activity_seen_account_id_activity_id_pk" PRIMARY KEY("account_id","activity_id")
);
--> statement-breakpoint
CREATE TABLE "reading_positions" (
	"account_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reading_positions_account_id_book_id_pk" PRIMARY KEY("account_id","book_id"),
	CONSTRAINT "reading_positions_position" CHECK ("reading_positions"."position" >= 1)
);
--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_kind";--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_sach";--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_niem_phong";--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "mood_id" uuid;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "detail" jsonb;--> statement-breakpoint
ALTER TABLE "activity_seen" ADD CONSTRAINT "activity_seen_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_seen" ADD CONSTRAINT "activity_seen_activity_id_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activity"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_positions" ADD CONSTRAINT "reading_positions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_positions" ADD CONSTRAINT "reading_positions_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_mood_id_moods_id_fk" FOREIGN KEY ("mood_id") REFERENCES "public"."moods"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_gop_idx" ON "activity" USING btree ("actor_id","kind","book_id","at");--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_tam_trang" CHECK (("activity"."kind" = 'tha-tam-trang') = ("activity"."mood_id" is not null) and ("activity"."kind" <> 'tha-tam-trang' or ("activity"."subject_id" is null and "activity"."book_id" is null and "activity"."round_id" is null and "activity"."seal_id" is null and "activity"."shared")));--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_detail" CHECK (("activity"."detail" is not null) = ("activity"."kind" in ('doi-ten-sach', 'doi-bia', 'doi-nhac', 'da-doc')) and ("activity"."detail" is null or jsonb_typeof("activity"."detail") = 'object'));--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_kind" CHECK ("activity"."kind" in ('dang-trang', 'moi-trao-doi', 'mo-hen-gio', 'mo-trang', 'thu-sai', 'tang-khoa', 'doi-mat-khau', 'hoi-dap', 'tha-tam-trang', 'tao-sach', 'doi-ten-sach', 'doi-bia', 'doi-nhac', 'sua-trang', 'da-doc'));--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_sach" CHECK ("activity"."kind" in ('doi-mat-khau', 'tha-tam-trang') or ("activity"."book_id" is not null and "activity"."subject_id" is null and ("activity"."round_id" is not null or "activity"."kind" in ('tao-sach', 'doi-ten-sach', 'doi-bia', 'doi-nhac')) and ("activity"."round_id" is null or "activity"."kind" not in ('tao-sach', 'doi-ten-sach'))));--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_niem_phong" CHECK (case when "activity"."kind" in ('moi-trao-doi', 'mo-hen-gio', 'mo-trang', 'thu-sai', 'tang-khoa') then "activity"."seal_id" is not null when "activity"."kind" in ('dang-trang', 'hoi-dap', 'doi-mat-khau') then true else "activity"."seal_id" is null end);--> statement-breakpoint
INSERT INTO "activity_seen" ("account_id", "activity_id", "seen_at")
SELECT a."id", h."id", h."at" FROM "accounts" a CROSS JOIN "activity" h;
--> statement-breakpoint
DO $$
DECLARE n bigint;
BEGIN
  SELECT count(*) INTO n FROM "activity_seen";
  IF n <> (SELECT count(*) FROM "accounts") * (SELECT count(*) FROM "activity") THEN
    RAISE EXCEPTION 'hoat-dong-moi: % dong da xem, can dung so tai khoan nhan so dong Hoat dong', n;
  END IF;
END $$;
