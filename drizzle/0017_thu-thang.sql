-- Thu thang (dot nam, phan 5b): bang thu_thang (moi nguoi mot la moi thang cho nguoi kia) va loai Hoat dong gui-thu.
-- Ba CHECK cua activity viet lai chi de them gui-thu, khong siet them loai cu nao, nen du lieu cu luon qua duoc; CHECK
-- moi activity_thu chi rang buoc dong gui-thu (chua co dong nao). Khong doi du lieu.
CREATE TABLE "thu_thang" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"thang" text NOT NULL,
	"noi_dung" text NOT NULL,
	"gui_luc" timestamp with time zone DEFAULT now() NOT NULL,
	"mo_luc" timestamp with time zone,
	CONSTRAINT "thu_thang_moi_thang" UNIQUE("account_id","thang"),
	CONSTRAINT "thu_thang_thang" CHECK ("thu_thang"."thang" ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
	CONSTRAINT "thu_thang_noi_dung" CHECK (char_length("thu_thang"."noi_dung") between 1 and 1000),
	CONSTRAINT "thu_thang_mo_luc" CHECK ("thu_thang"."mo_luc" is null or "thu_thang"."mo_luc" >= "thu_thang"."gui_luc")
);
--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_kind";--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_sach";--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_detail";--> statement-breakpoint
ALTER TABLE "thu_thang" ADD CONSTRAINT "thu_thang_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_thu" CHECK ("activity"."kind" <> 'gui-thu' or ("activity"."subject_id" is null and "activity"."book_id" is null and "activity"."round_id" is null and "activity"."seal_id" is null and "activity"."mood_id" is null and "activity"."shared"));--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_kind" CHECK ("activity"."kind" in ('dang-trang', 'moi-trao-doi', 'mo-hen-gio', 'mo-trang', 'thu-sai', 'tang-khoa', 'doi-mat-khau', 'hoi-dap', 'tha-tam-trang', 'tao-sach', 'doi-ten-sach', 'doi-bia', 'doi-nhac', 'sua-trang', 'da-doc', 'gui-thu'));--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_sach" CHECK ("activity"."kind" in ('doi-mat-khau', 'tha-tam-trang', 'gui-thu') or ("activity"."book_id" is not null and "activity"."subject_id" is null and ("activity"."round_id" is not null or "activity"."kind" in ('tao-sach', 'doi-ten-sach', 'doi-bia', 'doi-nhac')) and ("activity"."round_id" is null or "activity"."kind" not in ('tao-sach', 'doi-ten-sach'))));--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_detail" CHECK (("activity"."detail" is not null) = ("activity"."kind" in ('doi-ten-sach', 'doi-bia', 'doi-nhac', 'da-doc', 'gui-thu')) and ("activity"."detail" is null or jsonb_typeof("activity"."detail") = 'object'));