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

/**
 * Ngay theo gio Viet Nam cua luc tha, cung ranh gioi voi dayKey cua src/lib/when.ts.
 * Ranh gioi ngay Viet Nam duoc dien dat HAI NOI va phai luon khop nhau: o day (khoa ngay cua tung dong, nho
 * 'Asia/Ho_Chi_Minh' cua Postgres) va o khoangThang cua src/lib/tam-trang/lich.ts (khoang [from, to) cua thang,
 * bang UTC+7 co dinh). Sua mot ben thi phai sua ben kia, khong thi ngay dau va ngay cuoi thang se lech nhau.
 */
const NGAY_VN = sql<string>`to_char(${moods.setAt} at time zone 'Asia/Ho_Chi_Minh', 'YYYY-MM-DD')`;

/**
 * Tha mot tam trang moi: ket thuc tam trang dang hieu luc cua nguoi do roi chen dong moi giu 24 gio, trong mot giao
 * dich. Thu tu khoa toan du an: accounts (hay books) truoc, roi bang phu thuoc - o day chi khoa dong accounts
 * (SELECT ... FOR UPDATE, giong lockOwnBook cua library/remove.ts), moods di sau va khong bao gio bi khoa truoc.
 * Khoa nay lam hai lan tha cung luc cua mot nguoi xep hang, nen khong bao gio con hai dong cung hieu luc.
 * Tai khoan khong co thi tra null, va duong tra ve som do nam truoc moi lenh ghi.
 *
 * Moc tha la moc tien (monotonic) cua RIENG nguoi do, giong cach editRound day edited_at o library/edit-round.ts:
 * lay greatest(now, lan tha gan nhat + 1 ms). Vi CHECK moods_ends_at cam ends_at som hon set_at, neu dong ho may
 * chu lui ve truoc thi dong cu khong the ket thuc som hon set_at cua no; khong keo moc len thi dong cu van hieu luc
 * va lai xep TRUOC dong moi theo set_at, nen currentMoods se tra ve dung tam trang vua bi thay. Keo moc len 1 ms
 * bao dam dong cu luon ket thuc dung luc thay va dong moi luon xep sau cung: moi nguoi chi con mot bau troi.
 */
export async function setMood(db: AnyDb, accountId: string, weather: Weather, note: string | null, now: Date = new Date()): Promise<Mood | null> {
  return db.transaction(async (tx) => {
    const [ai] = await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, accountId)).for("update");
    if (!ai) return null;
    // Doc sau khi da khoa dong tai khoan nen khong ai chen them dong cua nguoi nay giua chung; di theo chi muc
    // moods_account_set_idx (account_id, set_at) nen chi la mot lan tim tren chi muc.
    const [truoc] = await tx
      .select({ setAt: moods.setAt })
      .from(moods)
      .where(eq(moods.accountId, accountId))
      .orderBy(desc(moods.setAt))
      .limit(1);
    const luc = truoc && truoc.setAt.getTime() >= now.getTime() ? new Date(truoc.setAt.getTime() + 1) : now;
    await tx.update(moods).set({ endsAt: ketThucLuc(luc) }).where(conHieuLuc(accountId, luc));
    const [moi] = await tx
      .insert(moods)
      .values({ accountId, weather, note, setAt: luc, endsAt: new Date(luc.getTime() + MOOD_TTL_MS) })
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

/**
 * Tam trang hien tai cua moi nguoi: dong moi nhat con ends_at > now, moi nguoi toi da mot dong.
 * Bo luon dong da thu lai: thu lai chi ha ends_at xuong bang set_at (CHECK moods_ends_at khong cho thap hon), nen
 * khi dong ho lui ve truoc, moc do van nam o tuong lai va dong da lay ve se lai hien len neu chi loc theo ends_at.
 */
export async function currentMoods(db: AnyDb, now: Date = new Date()): Promise<Mood[]> {
  return db
    .selectDistinctOn([moods.accountId], COT)
    .from(moods)
    .where(and(gt(moods.endsAt, now), eq(moods.withdrawn, false)))
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
