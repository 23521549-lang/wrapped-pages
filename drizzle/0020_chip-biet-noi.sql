-- Chip biet noi (dot nam, phan 5e): tin tro chuyen cua moi nguoi voi Chip (chip_tin), trang thai Chip cua moi nguoi
-- (chip_trang_thai: lan cuoi thay web, tat Chip, tat tu noi, lan cuoi thay Chip ngu) va luc Chip ngu toi (chip_nghi, mot
-- dong chung vi hai nguoi chung mot chia khoa AI). Ba bang moi, rong; khong doi bang hay du lieu cu nao.
CREATE TABLE "chip_nghi" (
	"khoa" text PRIMARY KEY NOT NULL,
	"den" timestamp with time zone NOT NULL,
	CONSTRAINT "chip_nghi_khoa" CHECK ("chip_nghi"."khoa" = 'groq')
);
--> statement-breakpoint
CREATE TABLE "chip_tin" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"vai" text NOT NULL,
	"noi_dung" text NOT NULL,
	"luc" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chip_tin_vai" CHECK ("chip_tin"."vai" in ('nguoi', 'chip')),
	CONSTRAINT "chip_tin_noi_dung" CHECK (char_length("chip_tin"."noi_dung") between 1 and 2000)
);
--> statement-breakpoint
CREATE TABLE "chip_trang_thai" (
	"account_id" uuid PRIMARY KEY NOT NULL,
	"lan_cuoi_thay" timestamp with time zone,
	"an" boolean DEFAULT false NOT NULL,
	"tu_noi" boolean DEFAULT true NOT NULL,
	"thay_ngu_luc" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "chip_tin" ADD CONSTRAINT "chip_tin_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chip_trang_thai" ADD CONSTRAINT "chip_trang_thai_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chip_tin_nguoi_luc_idx" ON "chip_tin" USING btree ("account_id","luc");