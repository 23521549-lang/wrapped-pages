-- Moc "da doc toi dau" thanh tap to da xem. drizzle-kit migrate chay moi migration dang cho trong MOT giao dich:
-- buoc kiem duoi RAISE thi ca migration huy, database giu nguyen nhu truoc. Phan chuyen du lieu duoc viet them vao
-- cuoi tep sinh tu schema.ts, vi moi moc cu (nguoi, cuon, p) nghia la "da doc to 1 toi p" nen phai tra ve tung to.
CREATE TABLE "read_sheets" (
	"account_id" uuid NOT NULL,
	"book_id" uuid NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "read_sheets_account_id_book_id_position_pk" PRIMARY KEY("account_id","book_id","position"),
	CONSTRAINT "read_sheets_position" CHECK ("read_sheets"."position" >= 1)
);
--> statement-breakpoint
ALTER TABLE "read_sheets" ADD CONSTRAINT "read_sheets_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "read_sheets" ADD CONSTRAINT "read_sheets_book_id_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."books"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "read_sheets_book_idx" ON "read_sheets" USING btree ("book_id","position");
--> statement-breakpoint
-- Chu sach khong co dong nao trong cuon cua chinh minh (xem read_sheets o schema.ts): mo hinh cu cung khong bao gio ghi
-- moc cho ho. Con mot moc nhu vay o that nghia la gia thiet do sai, va 0013 se xoa no di ma khong ai biet - dung han de
-- nguoi trien khai xem lai, dung am tham bo qua. Kiem truoc khi chuyen, nen phan chuyen ben duoi khong con phai loc.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM "read_marks" m
  JOIN "books" b ON b."id" = m."book_id"
  WHERE b."owner_id" = m."account_id";
  IF n > 0 THEN
    RAISE EXCEPTION 'to-da-xem: % moc doc cua chinh chu sach', n;
  END IF;
END $$;--> statement-breakpoint
INSERT INTO "read_sheets" ("account_id", "book_id", "position")
SELECT m."account_id", m."book_id", p."position"
FROM "read_marks" m
JOIN "pages" p ON p."book_id" = m."book_id" AND p."position" <= m."position"
WHERE m."position" >= 1;--> statement-breakpoint
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM "read_marks" m
  WHERE (SELECT count(*) FROM "read_sheets" s WHERE s."account_id" = m."account_id" AND s."book_id" = m."book_id")
     <> (SELECT count(*) FROM "pages" p WHERE p."book_id" = m."book_id" AND p."position" <= m."position");
  IF n > 0 THEN
    RAISE EXCEPTION 'to-da-xem: % moc doc khong chuyen du to', n;
  END IF;
END $$;