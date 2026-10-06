-- An hoat dong (06/10): them accounts.hoat_dong_an (lua chon cua nguoi dung) va activity.an (dau dong MOT LAN luc
-- ghi theo co cua nguoi lam). Ca hai mac dinh false, nen moi dong va moi tai khoan dang co giu nguyen hanh vi cu:
-- bat an ve sau khong sua lai qua khu. Chi them cot, khong doi mot dong du lieu nao.
ALTER TABLE "accounts" ADD COLUMN "hoat_dong_an" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "activity" ADD COLUMN "an" boolean DEFAULT false NOT NULL;