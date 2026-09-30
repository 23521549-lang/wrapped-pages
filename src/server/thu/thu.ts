import { and, asc, eq, isNull, ne, sql } from "drizzle-orm";
import { thuThang } from "@/server/db/schema";
import { readSnapshot } from "@/server/db/snapshot";
import type { AnyDb } from "@/server/db/types";
import { recordActivity } from "@/server/feed/record";
import { phanThang, thangKhoa, type Thang } from "@/lib/tam-trang/lich";
import { kiemThu, thangDaKhep, thangVuaKhep, type TrangThaiThu } from "@/lib/thu";

/*
 * Thu thang (dot nam 5b, spec E). Web chi co hai tai khoan, nen "nguoi kia" la moi dong co account_id khac nguoi xem.
 * Luat rieng tu: KHONG ham nao tra noi dung thu cho chinh nguoi viet. Moi cau doc noi dung deu loc account_id <> nguoi
 * xem ngay trong SQL, khong loc sau o JS.
 */

/**
 * "sent": vua luu va ghi dong Hoat dong. "exists": thang nay minh da gui (tab khac, hay bam hai lan), khong ghi gi.
 * "open": thang chua khep. "invalid": thang sai dang, hay chu khong qua kiemThu.
 */
export type GuiThuKetQua = "sent" | "exists" | "open" | "invalid";

/**
 * Gui thu thang cho nguoi kia, trong mot giao dich: kiem thang (da khep) va chu (kiemThu chuan hoa) truoc khi cham
 * database; chen ON CONFLICT DO NOTHING tren (account_id, thang), khong co dong tra ve la da gui roi; ghi gui-thu cung
 * giao dich. Thu khong sua, khong xoa.
 */
export async function guiThu(db: AnyDb, viewerId: string, thang: unknown, noiDung: unknown, now: Date = new Date()): Promise<GuiThuKetQua> {
  const t = phanThang(thang);
  if (t === null) return "invalid";
  if (!thangDaKhep(t, now)) return "open";
  const chu = kiemThu(noiDung);
  if (!chu.ok) return "invalid";
  const khoa = thangKhoa(t);
  return db.transaction(async (tx): Promise<GuiThuKetQua> => {
    const [moi] = await tx
      .insert(thuThang)
      .values({ accountId: viewerId, thang: khoa, noiDung: chu.noiDung, guiLuc: now })
      .onConflictDoNothing({ target: [thuThang.accountId, thuThang.thang] })
      .returning({ id: thuThang.id });
    if (!moi) return "exists";
    await recordActivity(tx, { kind: "gui-thu", actorId: viewerId, at: now, detail: { thang: khoa } });
    return "sent";
  });
}

/** Thu nguoi kia gui minh, nhu Lich hoa hien. */
export type ThuKia = { noiDung: string; guiLuc: Date; moLuc: Date | null };

/**
 * Thu cua mot thang nhin tu phia nguoi xem. kia chi co noi dung khi CA HAI da gui: cho thu o Lich hoa chi hien thu nguoi
 * kia sau khi minh gui (truoc do la to giay de viet). Thu cua minh chi con mot co minhGui.
 */
export type ThuThang = TrangThaiThu & { thang: string; kia: ThuKia | null };

/** Moi thang co thu (cua ai cung duoc), moi nhat truoc, doc tren mot anh chup. */
export async function thuCacThang(db: AnyDb, viewerId: string): Promise<ThuThang[]> {
  const [cuaMinh, cuaKia] = await readSnapshot(db, (tx) => Promise.all([
    tx.select({ thang: thuThang.thang }).from(thuThang).where(eq(thuThang.accountId, viewerId)),
    tx
      .select({ thang: thuThang.thang, noiDung: thuThang.noiDung, guiLuc: thuThang.guiLuc, moLuc: thuThang.moLuc })
      .from(thuThang)
      .where(ne(thuThang.accountId, viewerId)),
  ]));
  const minh = new Set(cuaMinh.map((r) => r.thang));
  const kia = new Map(cuaKia.map((r) => [r.thang, r]));
  // oxlint-disable-next-line unicorn/no-array-sort -- mang vua tao; toSorted can lib ES2023, du an dang o ES2022.
  const thang = [...new Set([...minh, ...kia.keys()])].sort((x, y) => (x < y ? 1 : x > y ? -1 : 0));
  return thang.map((k): ThuThang => {
    const x = kia.get(k);
    const minhGui = minh.has(k);
    return {
      thang: k, minhGui, kiaGui: x !== undefined,
      kia: minhGui && x !== undefined ? { noiDung: x.noiDung, guiLuc: x.guiLuc, moLuc: x.moLuc } : null,
    };
  });
}

/** La thu nguoi kia gui minh ma minh chua mo, cu nhat truoc (doc lan luot tung thang); khong co thi null. Khong mang noi dung. */
export async function thuChuaMo(db: AnyDb, viewerId: string): Promise<{ id: string; thang: string } | null> {
  const [r] = await db
    .select({ id: thuThang.id, thang: thuThang.thang })
    .from(thuThang)
    .where(and(ne(thuThang.accountId, viewerId), isNull(thuThang.moLuc)))
    .orderBy(asc(thuThang.thang), asc(thuThang.guiLuc))
    .limit(1);
  return r ?? null;
}

/** Thu nguoi kia vua duoc mo trong cua so doc thu, kem minh da gui thu thang do chua (co to giay tra loi hay khong). */
export type ThuMo = { thang: string; noiDung: string; guiLuc: Date; minhGui: boolean };

/**
 * Nguoi xem mo thu nguoi kia gui minh cua mot thang: ghi mo_luc lan dau (khong som hon gui_luc, CHECK thu_thang_mo_luc,
 * ke ca khi dong ho may chu lui), tra noi dung. Thang sai dang, chua co thu nguoi kia gui thi null.
 */
export async function moThu(db: AnyDb, viewerId: string, thang: unknown, now: Date = new Date()): Promise<ThuMo | null> {
  const t = phanThang(thang);
  if (t === null) return null;
  const khoa = thangKhoa(t);
  return db.transaction(async (tx): Promise<ThuMo | null> => {
    const [thu] = await tx
      .update(thuThang)
      .set({ moLuc: sql`coalesce(${thuThang.moLuc}, greatest(${now.toISOString()}::timestamptz, ${thuThang.guiLuc}))` })
      .where(and(ne(thuThang.accountId, viewerId), eq(thuThang.thang, khoa)))
      .returning({ noiDung: thuThang.noiDung, guiLuc: thuThang.guiLuc });
    if (!thu) return null;
    const [minh] = await tx
      .select({ id: thuThang.id })
      .from(thuThang)
      .where(and(eq(thuThang.accountId, viewerId), eq(thuThang.thang, khoa)));
    return { thang: khoa, noiDung: thu.noiDung, guiLuc: thu.guiLuc, minhGui: minh !== undefined };
  });
}

/** Dong nhac o Ke sach: thang vua khep va trang thai thu cua no, khi chinh nguoi xem chua gui; da gui thi null. */
export async function nhacThu(db: AnyDb, viewerId: string, now: Date = new Date()): Promise<{ thang: Thang; tt: TrangThaiThu } | null> {
  const thang = thangVuaKhep(now);
  const rows = await db
    .select({ accountId: thuThang.accountId })
    .from(thuThang)
    .where(eq(thuThang.thang, thangKhoa(thang)));
  const minhGui = rows.some((r) => r.accountId === viewerId);
  if (minhGui) return null;
  return { thang, tt: { minhGui, kiaGui: rows.some((r) => r.accountId !== viewerId) } };
}
