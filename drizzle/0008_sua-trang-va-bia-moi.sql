ALTER TABLE "books" DROP CONSTRAINT "books_cover";--> statement-breakpoint
ALTER TABLE "pages" ADD COLUMN "edited_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_cover" CHECK ("books"."cover" in ('nui-xa', 'khom-truc', 'trang-nuoc', 'chim-bay', 'hoa-dao', 'doi-chim', 'thuyen-trang', 'cau-go', 'doi-thong', 'meo-mai'));--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_edited_at" CHECK ("pages"."edited_at" is null or "pages"."edited_at" >= "pages"."published_at");