CREATE TABLE "moods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"weather" text NOT NULL,
	"note" text,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"withdrawn" boolean DEFAULT false NOT NULL,
	CONSTRAINT "moods_weather" CHECK ("moods"."weather" in ('nang-am', 'troi-trong', 'may-nhe', 'gio-thoang', 'mua-phun', 'mua-rao', 'giong', 'suong-mu', 'cau-vong')),
	CONSTRAINT "moods_note" CHECK ("moods"."note" is null or char_length("moods"."note") between 1 and 80),
	CONSTRAINT "moods_ends_at" CHECK ("moods"."ends_at" >= "moods"."set_at" and "moods"."ends_at" <= "moods"."set_at" + interval '24 hours')
);
--> statement-breakpoint
ALTER TABLE "moods" ADD CONSTRAINT "moods_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "moods_account_set_idx" ON "moods" USING btree ("account_id","set_at");