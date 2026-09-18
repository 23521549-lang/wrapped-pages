CREATE TABLE "trusted_devices" (
	"device_id" text PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "trusted_devices_account_idx" ON "trusted_devices" USING btree ("account_id","last_login_at");