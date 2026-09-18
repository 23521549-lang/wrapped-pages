CREATE TABLE "activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"actor_id" uuid NOT NULL,
	"subject_id" uuid,
	"book_id" uuid,
	"seal_id" uuid,
	"first_position" integer,
	"last_position" integer,
	"shared" boolean NOT NULL,
	"at" timestamp with time zone NOT NULL,
	CONSTRAINT "activity_kind" CHECK ("activity"."kind" in ('dang-trang', 'moi-trao-doi', 'mo-hen-gio', 'mo-trang', 'thu-sai', 'tang-khoa', 'doi-mat-khau')),
	CONSTRAINT "activity_sach" CHECK ("activity"."kind" = 'doi-mat-khau' or ("activity"."book_id" is not null and "activity"."subject_id" is null and "activity"."first_position" is not null and "activity"."last_position" is not null and "activity"."first_position" >= 1 and "activity"."last_position" >= "activity"."first_position")),
	CONSTRAINT "activity_niem_phong" CHECK ("activity"."kind" in ('dang-trang', 'doi-mat-khau') or "activity"."seal_id" is not null),
	CONSTRAINT "activity_mat_khau" CHECK ("activity"."kind" <> 'doi-mat-khau' or ("activity"."subject_id" is not null and "activity"."subject_id" <> "activity"."actor_id" and "activity"."book_id" is null and "activity"."seal_id" is null and "activity"."first_position" is null and "activity"."last_position" is null and "activity"."shared" = false))
);
--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_actor_id_accounts_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_subject_id_accounts_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity" ADD CONSTRAINT "activity_seal_id_seals_id_fk" FOREIGN KEY ("seal_id") REFERENCES "public"."seals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_at_idx" ON "activity" USING btree ("at");