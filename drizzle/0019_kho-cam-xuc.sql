-- Kho cam xuc (dot nam, phan 5d): bang cam_xuc (moi dong mot lan tha cho nguoi kia, da_xem_luc la luc linh vat cua nguoi
-- nhan dien no) va loai Hoat dong tha-cam-xuc. Ba CHECK cua activity viet lai chi de them tha-cam-xuc, khong siet loai cu
-- nao, nen du lieu cu luon qua duoc; CHECK moi activity_cam_xuc chi rang buoc dong tha-cam-xuc (chua co dong nao). Khong
-- doi du lieu.
CREATE TABLE "cam_xuc" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tu_id" uuid NOT NULL,
	"loai" text NOT NULL,
	"luc" timestamp with time zone DEFAULT now() NOT NULL,
	"da_xem_luc" timestamp with time zone,
	CONSTRAINT "cam_xuc_loai" CHECK ("cam_xuc"."loai" in ('yeu', 'nho', 'vui', 'buon', 'gian', 'bat-ngo', 'treu', 'biet-on')),
	CONSTRAINT "cam_xuc_da_xem" CHECK ("cam_xuc"."da_xem_luc" is null or "cam_xuc"."da_xem_luc" >= "cam_xuc"."luc")
);
--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_kind";--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_sach";--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_detail";--> statement-breakpoint
ALTER TABLE "cam_xuc" ADD CONSTRAINT "cam_xuc_tu_id_accounts_id_fk" FOREIGN KEY ("tu_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cam_xuc_tu_luc_idx" ON "cam_xuc" USING btree ("tu_id","luc");--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_cam_xuc" CHECK ("activity"."kind" <> 'tha-cam-xuc' or ("activity"."subject_id" is null and "activity"."book_id" is null and "activity"."round_id" is null and "activity"."seal_id" is null and "activity"."mood_id" is null and "activity"."shared"));--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_kind" CHECK ("activity"."kind" in ('dang-trang', 'moi-trao-doi', 'mo-hen-gio', 'mo-trang', 'thu-sai', 'tang-khoa', 'doi-mat-khau', 'hoi-dap', 'tha-tam-trang', 'tao-sach', 'doi-ten-sach', 'doi-bia', 'doi-nhac', 'sua-trang', 'da-doc', 'gui-thu', 'moi-viet', 'xin-viet', 'nhan-viet', 'tu-choi', 'de-nghi-xoa', 'doi-ten-luot', 'tha-cam-xuc'));--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_sach" CHECK ("activity"."kind" in ('doi-mat-khau', 'tha-tam-trang', 'gui-thu', 'tha-cam-xuc') or ("activity"."book_id" is not null and "activity"."subject_id" is null and ("activity"."round_id" is not null or "activity"."kind" in ('tao-sach', 'doi-ten-sach', 'doi-bia', 'doi-nhac', 'moi-viet', 'xin-viet', 'nhan-viet', 'tu-choi', 'de-nghi-xoa')) and ("activity"."round_id" is null or "activity"."kind" not in ('tao-sach', 'doi-ten-sach', 'moi-viet', 'xin-viet', 'nhan-viet', 'tu-choi', 'de-nghi-xoa'))));--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_detail" CHECK (("activity"."detail" is not null) = ("activity"."kind" in ('doi-ten-sach', 'doi-bia', 'doi-nhac', 'da-doc', 'gui-thu', 'nhan-viet', 'tu-choi', 'doi-ten-luot', 'tha-cam-xuc')) and ("activity"."detail" is null or jsonb_typeof("activity"."detail") = 'object'));