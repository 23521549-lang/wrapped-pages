CREATE TABLE "seal_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seal_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"guess" text NOT NULL,
	"correct" boolean NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seal_attempts_guess" CHECK (char_length("seal_attempts"."guess") <= 200)
);
--> statement-breakpoint
CREATE TABLE "seal_replies" (
	"seal_id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"content" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"book_id" uuid NOT NULL,
	"first_position" integer NOT NULL,
	"last_position" integer NOT NULL,
	"kind" text NOT NULL,
	"question" text,
	"answers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hints" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opens_at" timestamp with time zone,
	"opened_at" timestamp with time zone,
	"gift_note" text,
	"teaser" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seals_kind" CHECK ("seals"."kind" in ('cau-do', 'hen-gio', 'trao-doi')),
	CONSTRAINT "seals_range" CHECK ("seals"."first_position" >= 1 and "seals"."last_position" >= "seals"."first_position"),
	CONSTRAINT "seals_hen_gio" CHECK ("seals"."kind" <> 'hen-gio' or ("seals"."opens_at" is not null and "seals"."question" is null and "seals"."opened_at" is null and "seals"."gift_note" is null)),
	CONSTRAINT "seals_thu_thach" CHECK ("seals"."kind" = 'hen-gio' or ("seals"."question" is not null and "seals"."opens_at" is null)),
	CONSTRAINT "seals_dap_an" CHECK (("seals"."kind" = 'cau-do' and jsonb_array_length("seals"."answers") between 1 and 5) or ("seals"."kind" <> 'cau-do' and jsonb_array_length("seals"."answers") = 0)),
	CONSTRAINT "seals_goi_y" CHECK (jsonb_array_length("seals"."hints") <= 3 and ("seals"."kind" = 'cau-do' or jsonb_array_length("seals"."hints") = 0)),
	CONSTRAINT "seals_cau_hoi" CHECK ("seals"."question" is null or char_length("seals"."question") between 1 and 200),
	CONSTRAINT "seals_loi_nhan" CHECK ("seals"."gift_note" is null or char_length("seals"."gift_note") <= 200),
	CONSTRAINT "seals_he_lo" CHECK (char_length("seals"."teaser") <= 81)
);
--> statement-breakpoint
ALTER TABLE "seal_attempts" ADD CONSTRAINT "seal_attempts_seal_id_seals_id_fk" FOREIGN KEY ("seal_id") REFERENCES "public"."seals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seal_attempts" ADD CONSTRAINT "seal_attempts_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seal_replies" ADD CONSTRAINT "seal_replies_seal_id_seals_id_fk" FOREIGN KEY ("seal_id") REFERENCES "public"."seals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seal_replies" ADD CONSTRAINT "seal_replies_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seals" ADD CONSTRAINT "seals_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "seal_attempts_seal_at_idx" ON "seal_attempts" USING btree ("seal_id","at");--> statement-breakpoint
CREATE UNIQUE INDEX "seals_book_first_idx" ON "seals" USING btree ("book_id","first_position");