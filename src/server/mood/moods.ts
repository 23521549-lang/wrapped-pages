import { and, desc, eq, gt, gte, lt, sql } from "drizzle-orm";
import { accounts, moods } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { khoangThang, MOOD_TTL_MS, type DongLich, type Thang } from "@/lib/tam-trang/lich";
import type { Weather } from "@/lib/tam-trang/troi";

/*
 * Tam trang cua hai nguoi. Nhan db lam tham so, khong import next hay server-only, nen chay duoc tren database that
 * va PGlite. now la tham so de moc hieu luc (ends_at > now) cua ke sach va cua lan tha dung cung mot dong ho.
 * Khong ghi dong Hoat dong nao: tam trang khong thuoc dong Hoat dong.
 */

export type Mood = { id: string; accountId: string; weather: Weather; note: string | null; setAt: Date; endsAt: Date };

const COT = { id: moods.id, accountId: moods.accountId, weather: moods.weather, note: moods.note, setAt: moods.setAt, endsAt: moods.endsAt };

/** Luc ket thuc som: khong som hon set_at (CHECK moods_ends_at), ke ca khi dong ho may chu lech ve truoc. */
const ketThucLuc = (now: Date) => sql`greatest(${moods.setAt}, ${now.toISOString()}::timestamptz)`;

/** Cac dong con hieu luc tai now cua mot nguoi. */
const conHieuLuc = (accountId: string, now: Date) => and(eq(moods.accountId, accountId), gt(moods.endsAt, now));

/** Ngay theo gio Viet Nam cua luc tha, cung ranh gioi voi dayKey cua src/lib/when.ts. */
const NGAY_VN = sql<string>`to_char(${moods.setAt} at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')`;

/**
 * Tha mot tam trang moi: ket thuc tam trang dang hieu luc cua nguoi do roi chen dong moi giu 24 gio, trong mot giao
 * dich. Thu tu khoa toan du an: accounts (hay books) truoc, roi bang phu thuoc - o day chi khoa dong accounts
 * (SELECT ... FOR UPDATE, giong lockOwnBook cua library/remove.ts), moods di sau va khong bao gio bi khoa truoc.
 * Khoa nay lam hai lan tha cung luc cua mot nguoi xep hang, nen khong bao gio con hai dong cung hieu luc.
 * Tai khoan khong co thi tra null, va duong tra ve som do nam truoc moi lenh ghi.
 */
export async function setMood(db: AnyDb, accountId: string, weather: Weather, note: string | null, now: Date = new Date()): Promise<Mood | null> {
  return db.transaction(async (tx) => {
    const [ai] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, accountId)).for("update");
    if (!ai) return null;
    await tx.update(moods).set({ endsAt: ketThucLuc(now) }).where(conHieuLuc(accountId, now));
    const [moi] = await tx
      .insert(moods)
      .values({ accountId, weather, note, setAt: now, endsAt: new Date(now.getTime() + MOOD_TTL_MS) })
      .returning(COT);
    return moi;
  });
}

/**
 * Thu lai: nguoi do lay ve tam trang dang hieu luc cua chinh minh. Dong van giu (lich su) nhung danh dau withdrawn,
 * lich hoa bo qua. Mot cau UPDATE duy nhat nen tu no da nguyen to, khong can giao dich; va no chi khoa dong moods,
 * khong bao gio khoa accounts sau moods, nen van thuan thu tu khoa accounts truoc moods cua setMood.
 */
export async function withdrawMood(db: AnyDb, accountId: string, now: Date = new Date()): Promise<boolean> {
  const r = await db
    .update(moods)
    .set({ endsAt: ketThucLuc(now), withdrawn: true })
    .where(conHieuLuc(accountId, now))
    .returning({ id: moods.id });
  return r.length > 0;
}

/** Tam trang hien tai cua moi nguoi: dong moi nhat con ends_at > now, moi nguoi toi da mot dong. */
export async function currentMoods(db: AnyDb, now: Date = new Date()): Promise<Mood[]> {
  return db
    .selectDistinctOn([moods.accountId], COT)
    .from(moods)
    .where(gt(moods.endsAt, now))
    .orderBy(moods.accountId, desc(moods.setAt), desc(moods.id));
}

/**
 * Lich hoa cua mot thang: moi nguoi moi ngay (gio Viet Nam) mot dong, la dong CHUA THU LAI tha muon nhat trong ngay
 * (dong bi thay bang lan tha moi van tinh; dong da thu lai thi bo, ngay do lui ve dong truoc hoac de trong). Loc va
 * chon ngay trong SQL, nen so dong tra ve toi da hai lan so ngay cua thang.
 */
export async function moodCalendar(db: AnyDb, t: Thang): Promise<DongLich[]> {
  const { from, to } = khoangThang(t);
  return db
    .selectDistinctOn([moods.accountId, NGAY_VN], {
      id: moods.id, accountId: moods.accountId, weather: moods.weather, note: moods.note, setAt: moods.setAt, ngay: NGAY_VN,
    })
    .from(moods)
    .where(and(gte(moods.setAt, from), lt(moods.setAt, to), eq(moods.withdrawn, false)))
    .orderBy(moods.accountId, NGAY_VN, desc(moods.setAt), desc(moods.id));
}
