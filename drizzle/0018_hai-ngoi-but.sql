-- Sach viet cung "Hai Ngòi Bút" (dot nam, phan 5c). Tep sinh tu schema.ts roi sua tay phan chuyen du lieu:
-- - books.viet_cung_tu: null la sach mot nguoi viet (moi cuon cu); CHECK books_viet_cung chi rang buoc cuon co gia tri.
-- - rounds.tac_gia_id: them cot null duoc, dien bang chu cuon cua tung luot, roi moi dat NOT NULL; nen moi luot cu van
--   la cua chu cuon nhu truoc. rounds.ten null (luot cu hien "Lượt N").
-- - drafts.account_id: cung cach, dien bang chu cuon (truoc 0018 chi chu cuon co nhap), roi doi khoa chinh tu (book_id)
--   sang (book_id, account_id). Khoa chinh cu tao boi 0001 bang PRIMARY KEY tren cot nen mang ten mac dinh drafts_pkey.
-- - bang de_nghi moi, rong. Ba CHECK cua activity viet lai chi de them sau loai moi, khong siet loai cu nao.
-- drizzle-kit migrate chay moi migration dang cho trong MOT giao dich: buoc nao hong thi ca lan migrate huy.
CREATE TABLE "de_nghi" (
	"book_id" uuid PRIMARY KEY NOT NULL,
	"loai" text NOT NULL,
	"tu_id" uuid NOT NULL,
	"luc" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "de_nghi_loai" CHECK ("de_nghi"."loai" in ('moi-viet', 'xin-viet', 'xoa-sach'))
);
--> statement-breakpoint
ALTER TABLE "books" ADD COLUMN "viet_cung_tu" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "tac_gia_id" uuid;--> statement-breakpoint
UPDATE "rounds" SET "tac_gia_id" = "books"."owner_id" FROM "books" WHERE "books"."id" = "rounds"."book_id";--> statement-breakpoint
ALTER TABLE "rounds" ALTER COLUMN "tac_gia_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "rounds" ADD COLUMN "ten" text;--> statement-breakpoint
ALTER TABLE "drafts" ADD COLUMN "account_id" uuid;--> statement-breakpoint
UPDATE "drafts" SET "account_id" = "books"."owner_id" FROM "books" WHERE "books"."id" = "drafts"."book_id";--> statement-breakpoint
ALTER TABLE "drafts" ALTER COLUMN "account_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "drafts" DROP CONSTRAINT "drafts_pkey";--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_book_id_account_id_pk" PRIMARY KEY("book_id","account_id");--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_kind";--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_sach";--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_detail";--> statement-breakpoint
ALTER TABLE "de_nghi" ADD CONSTRAINT "de_nghi_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "de_nghi" ADD CONSTRAINT "de_nghi_tu_id_accounts_id_fk" FOREIGN KEY ("tu_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_tac_gia_id_accounts_id_fk" FOREIGN KEY ("tac_gia_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_kind" CHECK ("activity"."kind" in ('dang-trang', 'moi-trao-doi', 'mo-hen-gio', 'mo-trang', 'thu-sai', 'tang-khoa', 'doi-mat-khau', 'hoi-dap', 'tha-tam-trang', 'tao-sach', 'doi-ten-sach', 'doi-bia', 'doi-nhac', 'sua-trang', 'da-doc', 'gui-thu', 'moi-viet', 'xin-viet', 'nhan-viet', 'tu-choi', 'de-nghi-xoa', 'doi-ten-luot'));--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_sach" CHECK ("activity"."kind" in ('doi-mat-khau', 'tha-tam-trang', 'gui-thu') or ("activity"."book_id" is not null and "activity"."subject_id" is null and ("activity"."round_id" is not null or "activity"."kind" in ('tao-sach', 'doi-ten-sach', 'doi-bia', 'doi-nhac', 'moi-viet', 'xin-viet', 'nhan-viet', 'tu-choi', 'de-nghi-xoa')) and ("activity"."round_id" is null or "activity"."kind" not in ('tao-sach', 'doi-ten-sach', 'moi-viet', 'xin-viet', 'nhan-viet', 'tu-choi', 'de-nghi-xoa'))));--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_detail" CHECK (("activity"."detail" is not null) = ("activity"."kind" in ('doi-ten-sach', 'doi-bia', 'doi-nhac', 'da-doc', 'gui-thu', 'nhan-viet', 'tu-choi', 'doi-ten-luot')) and ("activity"."detail" is null or jsonb_typeof("activity"."detail") = 'object'));--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_viet_cung" CHECK ("books"."viet_cung_tu" is null or "books"."mode" = 'chia-se');--> statement-breakpoint
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_ten" CHECK ("rounds"."ten" is null or char_length("rounds"."ten") between 1 and 60);
