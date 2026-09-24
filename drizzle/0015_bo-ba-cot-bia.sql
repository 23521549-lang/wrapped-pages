-- Bo ba cot bia va nhac cua books. Chieu nguoc lai khong co: du lieu da nam o book_covers va book_tracks tu 0014.
-- Vi the phai SAO LUU TRUOC khi migrate production, khong co ngoai le.
ALTER TABLE "books" DROP CONSTRAINT "books_cover";--> statement-breakpoint
ALTER TABLE "books" DROP CONSTRAINT "books_youtube_id";--> statement-breakpoint
ALTER TABLE "books" DROP CONSTRAINT "books_cover_media_id_media_id_fk";
--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "cover";--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "youtube_id";--> statement-breakpoint
ALTER TABLE "books" DROP COLUMN "cover_media_id";