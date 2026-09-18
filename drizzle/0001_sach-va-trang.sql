CREATE TABLE "books" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"mode" text NOT NULL,
	"cover" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "books_mode" CHECK ("books"."mode" in ('chia-se', 'rieng-tu')),
	CONSTRAINT "books_cover" CHECK ("books"."cover" in ('nui-xa', 'khom-truc', 'trang-nuoc', 'chim-bay'))
);
--> statement-breakpoint
CREATE TABLE "drafts" (
	"book_id" uuid PRIMARY KEY NOT NULL,
	"content" jsonb NOT NULL,
	"sheet_count" integer DEFAULT 1 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"content" jsonb NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pages_position" CHECK ("pages"."position" >= 1)
);
--> statement-breakpoint
CREATE TABLE "read_marks" (
	"account_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "read_marks_account_id_book_id_pk" PRIMARY KEY("account_id","book_id")
);
--> statement-breakpoint
ALTER TABLE "books" ADD CONSTRAINT "books_owner_id_accounts_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drafts" ADD CONSTRAINT "drafts_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pages" ADD CONSTRAINT "pages_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_marks" ADD CONSTRAINT "read_marks_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_marks" ADD CONSTRAINT "read_marks_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "books_owner_idx" ON "books" USING btree ("owner_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pages_book_position_idx" ON "pages" USING btree ("book_id","position");