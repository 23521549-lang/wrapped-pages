CREATE TABLE "round_replies" (
	"round_id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "round_replies_body" CHECK (char_length("round_replies"."body") between 1 and 1000)
);
--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_kind";--> statement-breakpoint
ALTER TABLE "activity" DROP CONSTRAINT "activity_niem_phong";--> statement-breakpoint
ALTER TABLE "round_replies" ADD CONSTRAINT "round_replies_round_id_rounds_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."rounds"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "round_replies" ADD CONSTRAINT "round_replies_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_kind" CHECK ("activity"."kind" in ('dang-trang', 'moi-trao-doi', 'mo-hen-gio', 'mo-trang', 'thu-sai', 'tang-khoa', 'doi-mat-khau', 'hoi-dap'));--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_niem_phong" CHECK ("activity"."kind" in ('dang-trang', 'doi-mat-khau', 'hoi-dap') or "activity"."seal_id" is not null);