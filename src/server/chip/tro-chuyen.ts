import { and, desc, eq, gt, sql } from "drizzle-orm";
import { accounts, chipNghi, chipTin, chipTrangThai } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import { listActivity } from "@/server/feed/list";
import {
  bayGioSangMai, CACH_HOI_MS, CAU_CHUA_DANH_THUC, CAU_NGHE_CHUA_RO, cauDiNgu, cauThoChut, GIU_TIN, kiemTinChip, lamSachTraLoi,
  loiDanChip, NGU_CANH_TIN, NGU_TU_MS, VANG_LAU_MS,
} from "@/lib/chip";
import { docChiTietThu, docChiTietCamXuc } from "@/lib/feed/detail";
import { feedLine } from "@/lib/feed/line";
import type { FeedItem } from "@/lib/feed/types";
import { CAM_XUC } from "@/lib/cam-xuc";
import { phanThang, tenThang } from "@/lib/tam-trang/lich";
import { TROI } from "@/lib/tam-trang/troi";
import { dayKey } from "@/lib/when";
import { goiGroq, moiTruongThat, type MoiTruongGoi } from "./groq";
import { dungNguCanh, lamSachTrang, lamSachViec } from "./ngu-canh";

/*
 * Tro chuyen voi Chip (dot nam 5e, spec C, D, E, F). Moi cau doc tin loc account_id = nguoi xem: khong ham nao tra tin
 * cua nguoi kia. Ngu canh gui AI dung o ngu-canh.ts, chi tu du lieu nguoi hoi von thay.
 */

/** Mot tin nhu to tro chuyen hien. */
export type TinChip = { id: string; vai: "nguoi" | "chip"; noiDung: string; luc: Date };

/** Trang thai Chip cua mot nguoi luc ve trang. */
export type TrangThaiChip = { an: boolean; tuNoi: boolean; nguDen: Date | null; coKhoa: boolean };

const COT_TIN = { id: chipTin.id, vai: chipTin.vai, noiDung: chipTin.noiDung, luc: chipTin.luc };

/** Luc Chip dang ngu toi (con trong tuong lai), khong thi null. */
async function nguDen(db: AnyDb, now: Date): Promise<Date | null> {
  const [r] = await db.select({ den: chipNghi.den }).from(chipNghi).where(and(eq(chipNghi.khoa, "groq"), gt(chipNghi.den, now)));
  return r?.den ?? null;
}

async function ghiTin(db: AnyDb, accountId: string, vai: "nguoi" | "chip", noiDung: string, luc: Date): Promise<TinChip> {
  const [t] = await db.insert(chipTin).values({ accountId, vai, noiDung, luc }).returning(COT_TIN);
  return t;
}

/** Xoa tin cu hon GIU_TIN tin gan nhat cua mot nguoi. */
async function tiaTin(db: AnyDb, accountId: string): Promise<void> {
  const giu = db.select({ id: chipTin.id }).from(chipTin).where(eq(chipTin.accountId, accountId)).orderBy(desc(chipTin.luc), desc(chipTin.id)).limit(GIU_TIN);
  await db.delete(chipTin).where(and(eq(chipTin.accountId, accountId), sql`${chipTin.id} not in (${giu})`));
}

/** Tin gan nhat cua mot nguoi (cu toi moi), toi da gioiHan. */
export async function docTroChuyen(db: AnyDb, viewerId: string, gioiHan = 60): Promise<TinChip[]> {
  const rows = await db.select(COT_TIN).from(chipTin).where(eq(chipTin.accountId, viewerId)).orderBy(desc(chipTin.luc), desc(chipTin.id)).limit(gioiHan);
  // oxlint-disable-next-line unicorn/no-array-reverse -- mang vua doc ra; toReversed can lib ES2023, du an dang o ES2022.
  return rows.reverse();
}

/** Xoa het tin cua chinh nguoi xem (Cai dat, "Xóa cuộc trò chuyện"). */
export async function xoaTroChuyen(db: AnyDb, viewerId: string): Promise<void> {
  await db.delete(chipTin).where(eq(chipTin.accountId, viewerId));
}

/**
 * Ket qua mot lan hoi. "ok": tin cua nguoi hoi da luu va cau Chip (luu hay khong, tuy loai); nguDen khac null khi Chip vua
 * di ngu hay dang ngu. "invalid": tin rong hay qua dai. "som": vua hoi chua du 3 giay.
 */
export type HoiKetQua =
  | { kieu: "ok"; tin: TinChip[]; nguDen: Date | null }
  | { kieu: "invalid" }
  | { kieu: "som" };

/**
 * Nguoi xem noi voi Chip. Luu tin cua ho (khoa dong tai khoan de hai lan gui cung luc khong cung lot moc 3 giay), roi: Chip
 * dang ngu thi tra cau ngu (khong goi AI); khong thi dung ngu canh + 16 tin gan nhat, goi Groq. Het han muc ngay thi ghi
 * luc ngu cho ca hai nguoi; het han muc phut thi xin cho; loi khac thi xin noi lai (cau loi khong luu, khong vao ngu canh).
 */
export async function hoiChip(
  db: AnyDb,
  viewerId: string,
  tenMinh: string,
  tenKia: string,
  raw: unknown,
  trangRaw: unknown,
  viecRaw: unknown,
  now: Date = new Date(),
  mt: MoiTruongGoi = moiTruongThat(),
): Promise<HoiKetQua> {
  const kiem = kiemTinChip(raw);
  if (!kiem.ok) return { kieu: "invalid" };
  const cuaNguoi = await db.transaction(async (tx): Promise<TinChip | null> => {
    await tx.select({ id: accounts.id }).from(accounts).where(eq(accounts.id, viewerId)).for("update");
    const [gan] = await tx
      .select({ id: chipTin.id })
      .from(chipTin)
      .where(and(eq(chipTin.accountId, viewerId), eq(chipTin.vai, "nguoi"), gt(chipTin.luc, new Date(now.getTime() - CACH_HOI_MS))))
      .limit(1);
    if (gan) return null;
    return ghiTin(tx, viewerId, "nguoi", kiem.noiDung, now);
  });
  if (cuaNguoi === null) return { kieu: "som" };

  const dangNgu = await nguDen(db, now);
  if (dangNgu !== null) {
    await ghiThayNgu(db, viewerId, now);
    return { kieu: "ok", tin: [cuaNguoi, await ghiTin(db, viewerId, "chip", cauDiNgu(dangNgu, now), now)], nguDen: dangNgu };
  }

  const [nguCanh, lichSu] = await Promise.all([
    dungNguCanh(db, viewerId, tenMinh, tenKia, lamSachTrang(trangRaw), lamSachViec(viecRaw), now),
    docTroChuyen(db, viewerId, NGU_CANH_TIN),
  ]);
  const kq = await goiGroq([
    { role: "system", content: loiDanChip(tenMinh, tenKia, nguCanh) },
    ...lichSu.map((t) => ({ role: t.vai === "nguoi" ? ("user" as const) : ("assistant" as const), content: t.noiDung })),
  ], mt);
  const luc = new Date(now.getTime() + 1);

  if (kq.kieu === "ok") {
    const cau = lamSachTraLoi(kq.noiDung);
    const tin = [cuaNguoi, ...(cau === "" ? [] : [await ghiTin(db, viewerId, "chip", cau, luc)])];
    await tiaTin(db, viewerId);
    return { kieu: "ok", tin, nguDen: null };
  }
  if (kq.kieu === "het" && (kq.retryAfterGiay === null || kq.retryAfterGiay * 1000 >= NGU_TU_MS)) {
    const den = kq.retryAfterGiay === null ? bayGioSangMai(now) : new Date(now.getTime() + kq.retryAfterGiay * 1000);
    await db.insert(chipNghi).values({ khoa: "groq", den }).onConflictDoUpdate({ target: chipNghi.khoa, set: { den } });
    await ghiThayNgu(db, viewerId, now);
    return { kieu: "ok", tin: [cuaNguoi, await ghiTin(db, viewerId, "chip", cauDiNgu(den, now), luc)], nguDen: den };
  }
  const tam = kq.kieu === "het" ? cauThoChut(kq.retryAfterGiay ?? 30) : kq.kieu === "chua-co-khoa" ? CAU_CHUA_DANH_THUC : CAU_NGHE_CHUA_RO;
  return { kieu: "ok", tin: [cuaNguoi, { id: `tam-${now.getTime()}`, vai: "chip", noiDung: tam, luc }], nguDen: null };
}

/** Ghi lan dau nguoi nay thay Chip ngu (de lan dau thay Chip thuc lai thi chao "day roi"). */
async function ghiThayNgu(db: AnyDb, accountId: string, now: Date): Promise<void> {
  await db
    .insert(chipTrangThai)
    .values({ accountId, thayNguLuc: now })
    .onConflictDoUpdate({ target: chipTrangThai.accountId, set: { thayNguLuc: sql`coalesce(${chipTrangThai.thayNguLuc}, ${now.toISOString()}::timestamptz)` } });
}

/** Trang thai Chip cua nguoi xem: tat, tu noi, dang ngu toi dau, da co chia khoa AI chua. */
export async function trangThaiChip(db: AnyDb, viewerId: string, now: Date = new Date(), mt: Pick<MoiTruongGoi, "khoa"> = moiTruongThat()): Promise<TrangThaiChip> {
  const [[r], den] = await Promise.all([
    db.select({ an: chipTrangThai.an, tuNoi: chipTrangThai.tuNoi }).from(chipTrangThai).where(eq(chipTrangThai.accountId, viewerId)),
    nguDen(db, now),
  ]);
  return { an: r?.an ?? false, tuNoi: r?.tuNoi ?? true, nguDen: den, coKhoa: mt.khoa !== undefined };
}

/** Doi cai dat Chip cua nguoi xem (Cai dat): hien hay tat, tu noi hay khong. */
export async function datCaiDatChip(db: AnyDb, viewerId: string, dat: { an?: boolean; tuNoi?: boolean }): Promise<void> {
  const set: { an?: boolean; tuNoi?: boolean } = {};
  if (typeof dat.an === "boolean") set.an = dat.an;
  if (typeof dat.tuNoi === "boolean") set.tuNoi = dat.tuNoi;
  if (Object.keys(set).length === 0) return;
  await db.insert(chipTrangThai).values({ accountId: viewerId, ...set }).onConflictDoUpdate({ target: chipTrangThai.accountId, set });
}

/** Mot cau Chip tu noi (spec C): cau co **dam**, kem mot nut tuy chon (chu va lien ket). */
export type LoiChao = { loai: "quay-lai" | "chao" | "thuc-day"; cau: string; nut: { nhan: string; href: string } | null };

/** Viec moi nhat cua nguoi kia ma nguoi xem chua xem, thanh cau nhu cot Hoat dong (in dam bang **). */
function chuyenMoi(items: FeedItem[], tenKia: string): { cau: string; href: string | null } | null {
  const it = items.find((i) => i.by === "partner" && i.isNew);
  if (it === undefined) return null;
  const line = feedLine(it, { partner: tenKia });
  return { cau: line.sentence.map((d) => (d.dam ? `**${d.chu}**` : d.chu)).join(""), href: line.href };
}

/** Tom tat viec nguoi kia lam tu mot moc, cho cau "ve roi". */
function tomTat(items: FeedItem[], tu: Date): string[] {
  const cua = items.filter((i) => i.by === "partner" && i.at > tu);
  const ra: string[] = [];
  const tam = cua.find((i) => i.kind === "tha-tam-trang");
  if (tam?.weather) ra.push(`thả tâm trạng **${TROI[tam.weather].ten}**`);
  const trang = cua.filter((i) => i.kind === "dang-trang").reduce((n, i) => n + ((i.lastPosition ?? 0) - (i.firstPosition ?? 0) + 1), 0);
  if (trang > 0) ra.push(`viết **${trang} trang mới**`);
  const thu = cua.find((i) => i.kind === "gui-thu");
  const t = thu === undefined ? null : phanThang(docChiTietThu(thu.detail)?.thang);
  if (thu !== undefined) ra.push(`gửi **${t === null ? "thư tháng" : `thư ${tenThang(t)}`}**`);
  const cam = cua.filter((i) => i.kind === "tha-cam-xuc");
  if (cam.length === 1) {
    const c = docChiTietCamXuc(cam[0].detail)?.cam;
    ra.push(c === undefined ? "thả **một cảm xúc**" : `thả cảm xúc **${CAM_XUC[c].camXuc}**`);
  } else if (cam.length > 1) ra.push(`thả **${cam.length} cảm xúc**`);
  return ra;
}

const noiVoi = (ds: string[]) => (ds.length <= 1 ? ds.join("") : `${ds.slice(0, -1).join(", ")} và ${ds[ds.length - 1]}`);

function buoi(now: Date): string {
  const h = (now.getUTCHours() + 7) % 24;
  return h < 11 ? "buổi sáng" : h < 14 ? "buổi trưa" : h < 18 ? "buổi chiều" : "buổi tối";
}

function khoangVang(ms: number): string {
  const gio = Math.floor(ms / 3600_000);
  if (gio < 24) return `${gio} tiếng rồi đó`;
  const ngay = Math.floor(gio / 24);
  return `${ngay} ngày rồi đó`;
}

/**
 * Chip chao khi nguoi xem mo mot trang (spec C2): tinh cau tu noi (quay lai, chao trong ngay, day roi) tu du lieu nguoi xem
 * von thay, roi ghi lan cuoi thay web. Khong goi AI. Tat tu noi (hay dang tat Chip) thi van ghi moc nhung khong noi.
 */
export async function chaoChip(db: AnyDb, viewerId: string, tenMinh: string, tenKia: string, now: Date = new Date()): Promise<LoiChao | null> {
  const [[tt], den] = await Promise.all([
    db.select().from(chipTrangThai).where(eq(chipTrangThai.accountId, viewerId)),
    nguDen(db, now),
  ]);
  const cu = tt?.lanCuoiThay ?? null;
  const thayNgu = tt?.thayNguLuc ?? null;
  await db
    .insert(chipTrangThai)
    .values({ accountId: viewerId, lanCuoiThay: now, thayNguLuc: den !== null ? (thayNgu ?? now) : null })
    .onConflictDoUpdate({ target: chipTrangThai.accountId, set: { lanCuoiThay: now, thayNguLuc: den !== null ? (thayNgu ?? now) : null } });
  if (tt?.an === true || tt?.tuNoi === false || den !== null) return null;

  const items = await listActivity(db, viewerId, now);
  const moi = chuyenMoi(items, tenKia);
  const nutMoi = moi?.href ? { nhan: "Xem ngay", href: moi.href } : null;
  if (thayNgu !== null) {
    return { loai: "thuc-day", cau: `Chíp dậy rồi! Chào ${buoi(now)} **${tenMinh}**.${moi ? ` ${moi.cau}.` : ""}`, nut: nutMoi };
  }
  if (cu !== null && now.getTime() - cu.getTime() >= VANG_LAU_MS) {
    const tom = tomTat(items, cu);
    const them = tom.length > 0 ? ` Trong lúc ${tenMinh} đi, ${tenKia} ${noiVoi(tom)}.` : "";
    return { loai: "quay-lai", cau: `**${tenMinh}** về rồi! ${khoangVang(now.getTime() - cu.getTime())}.${them}`, nut: nutMoi };
  }
  if (cu === null || dayKey(cu) !== dayKey(now)) {
    return { loai: "chao", cau: `Chào **${tenMinh}**!${moi ? ` ${moi.cau} đó.` : ""}`, nut: nutMoi };
  }
  return null;
}
