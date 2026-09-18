import { and, desc, eq, gte, lt, notInArray, sql } from "drizzle-orm";
import { loginAttempts, trustedDevices } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";

/** Nguong rieng cua MOT trinh duyet: sai tu MAX_FAILS lan trong WINDOW_MS thi trinh duyet do bi khoa. */
export const MAX_FAILS = 5;
export const WINDOW_MS = 15 * 60 * 1000;

/**
 * Nguong CHUNG cho moi trinh duyet la (chua tung dang nhap thanh cong o day): tong so lan sai cua
 * tat ca trinh duyet la trong UNTRUSTED_WINDOW_MS cham UNTRUSTED_MAX_FAILS thi MOI trinh duyet la
 * deu bi chan, ke ca trinh duyet vua tao cookie. deviceId den tu cookie ma ke do mat khau bo di duoc
 * bat cu luc nao, nen chi nguong nay moi dat tran cho toc do do: 10 lan moi gio, 240 lan moi ngay.
 * Khong gian mat khau ~1.68e9 va co hai tai khoan, nen ky vong phai do ~6.4 nghin nam, xac suat
 * trung trong mot nam ~1e-4.
 */
export const UNTRUSTED_MAX_FAILS = 10;
export const UNTRUSTED_WINDOW_MS = 60 * 60 * 1000;

/** Moi tai khoan chi giu tu choi nay trinh duyet tin cay dung gan nhat; bang trusted_devices co tran. */
export const MAX_TRUSTED_PER_ACCOUNT = 10;

/** Dong nao cu hon cua so dai nhat thi khong con anh huong gi toi viec khoa. */
const KEEP_MS = Math.max(WINDOW_MS, UNTRUSTED_WINDOW_MS);

/** "bi-khoa": chinh trinh duyet nay sai qua nhieu. "khoa-chung": trinh duyet la bi chan vi dang co ke do mat khau. */
export type LockReason = "bi-khoa" | "khoa-chung";

async function donRac(db: AnyDb, now: Date) {
  // Don rac truoc khi ghi de bang khong phinh ra mai mai. Chi so tren cot `at` giu lenh xoa nay re.
  await db.delete(loginAttempts).where(lt(loginAttempts.at, new Date(now.getTime() - KEEP_MS)));
}

async function dem(db: AnyDb, deviceId: string, now: Date) {
  const sinceDevice = new Date(now.getTime() - WINDOW_MS);
  const sinceChung = new Date(now.getTime() - UNTRUSTED_WINDOW_MS);
  const tinCay = db.select({ id: trustedDevices.deviceId }).from(trustedDevices);
  const [row] = await db
    .select({
      // Moc thoi gian phai di qua toan tu cua drizzle (gte) de duoc ma hoa theo kieu cot: dat Date tran
      // vao sql`` thi postgres-js (database that) tu choi, du PGlite trong unit test van nhan.
      device: sql<number>`count(*) filter (where ${and(eq(loginAttempts.deviceId, deviceId), gte(loginAttempts.at, sinceDevice))})::int`,
      la: sql<number>`count(*) filter (where ${notInArray(loginAttempts.deviceId, tinCay)})::int`,
      tinCay: sql<boolean>`exists (select 1 from ${trustedDevices} where ${trustedDevices.deviceId} = ${deviceId})`,
    })
    .from(loginAttempts)
    .where(gte(loginAttempts.at, sinceChung));
  return { device: row?.device ?? 0, la: row?.la ?? 0, tinCay: row?.tinCay ?? false };
}

/** `truoc`: so dong da tinh san cho chinh lan thu nay (0 khi chi hoi, 1 khi dong cua lan nay da nam trong bang). */
function phanXu(c: { device: number; la: number; tinCay: boolean }, truoc: 0 | 1): LockReason | null {
  if (c.device - truoc >= MAX_FAILS) return "bi-khoa";
  // Trinh duyet tin cay khong chiu nguong chung: ke do mat khau khong gia duoc no (cookie ngau nhien
  // 122 bit, chi co sau mot lan dang nhap dung), nen tran sai tu trinh duyet la khong khoa duoc hai nguoi that.
  if (!c.tinCay && c.la - truoc >= UNTRUSTED_MAX_FAILS) return "khoa-chung";
  return null;
}

/**
 * Giu cho TRUOC khi thu mat khau: ghi dong cua lan thu nay roi moi dem, dem ca chinh no. Hoi truoc
 * roi ghi sau thi mot loat yeu cau dong thoi cung doc thay "chua toi nguong" va cung lot qua; ghi
 * truoc thi yeu cau thu k luon thay it nhat k dong, nen khong qua nguong duoc du gui song song.
 * Bi khoa thi xoa ngay dong vua ghi: go mai khi dang bi khoa khong lam bang phinh ra, cung khong keo dai khoa.
 * Dong giu lai chinh la lan sai neu mat khau sai; dung hoac khong tinh la sai thi releaseAttempt.
 *
 * Tranh nhieu lan thu dong thoi: moi dong duoc commit truoc khi yeu cau ghi no dem, va dong cua lan
 * lot qua khong bao gio bi xoa truoc khi xet xong mat khau. Duoi READ COMMITTED, lenh dem cua moi
 * yeu cau bat dau sau khi chinh dong cua no da ghi, nen neu k yeu cau da lot qua va dong cua chung
 * da commit thi yeu cau thu k+1 thay it nhat k+1 dong. Hai yeu cau thuc su xen ke (ghi A, ghi B,
 * dem A, dem B) thi ca hai thay nhieu hon, tuc la chan sot hon chu khong lot them.
 */
export async function beginAttempt(
  db: AnyDb, deviceId: string, now: Date = new Date(),
): Promise<{ lock: LockReason } | { id: string }> {
  await donRac(db, now);
  const [row] = await db.insert(loginAttempts).values({ deviceId, at: now }).returning({ id: loginAttempts.id });
  const lock = phanXu(await dem(db, deviceId, now), 1);
  if (lock) {
    await releaseAttempt(db, row.id);
    return { lock };
  }
  return { id: row.id };
}

export async function releaseAttempt(db: AnyDb, id: string) {
  await db.delete(loginAttempts).where(eq(loginAttempts.id, id));
}

/**
 * Ghi nho trinh duyet vua dang nhap dung. Mot trinh duyet chi thuoc mot tai khoan (nguoi dang nhap
 * sau cung); moi tai khoan chi giu MAX_TRUSTED_PER_ACCOUNT trinh duyet dung gan nhat.
 */
export async function trustDevice(
  db: AnyDb, input: { deviceId: string; accountId: string }, now: Date = new Date(),
) {
  await db
    .insert(trustedDevices)
    .values({ deviceId: input.deviceId, accountId: input.accountId, lastLoginAt: now })
    .onConflictDoUpdate({
      target: trustedDevices.deviceId,
      set: { accountId: input.accountId, lastLoginAt: now },
    });
  const giu = db
    .select({ id: trustedDevices.deviceId })
    .from(trustedDevices)
    .where(eq(trustedDevices.accountId, input.accountId))
    .orderBy(desc(trustedDevices.lastLoginAt), desc(trustedDevices.deviceId))
    .limit(MAX_TRUSTED_PER_ACCOUNT);
  await db
    .delete(trustedDevices)
    .where(and(eq(trustedDevices.accountId, input.accountId), notInArray(trustedDevices.deviceId, giu)));
}
