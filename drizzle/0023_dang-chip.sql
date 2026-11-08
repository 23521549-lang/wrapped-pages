ALTER TABLE "chip_trang_thai" ADD COLUMN "dang" text DEFAULT 'ga-con' NOT NULL;
--> statement-breakpoint
ALTER TABLE "chip_trang_thai" ADD CONSTRAINT "chip_trang_thai_dang" CHECK ("dang" in ('ga-con', 'blob', 'dai-bang'));
