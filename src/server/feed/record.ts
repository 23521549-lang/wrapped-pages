import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { activity } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import type { BookMode } from "@/lib/book";
import {
  docChiTietBia, docChiTietDaDoc, docChiTietNhac, docChiTietTen, giongNhau,
  type ChiTietBia, type ChiTietDaDoc, type ChiTietNhac, type ChiTietNhanViet, type ChiTietTen, type ChiTietTenLuot,
  type ChiTietThu, type ChiTietTuChoi,
} from "@/lib/feed/detail";
import type { LoaiNiemPhong } from "@/lib/feed/types";

/** Cua so gop cua doi ten, doi bia, doi nhac va sua trang: thu vai lan lien nhau chi thanh mot dong. */
export const GOP_DOI_MS = 10 * 60_000;
/** Cua so gop cua da doc: mot buoi doc (lat qua nhieu trang) chi thanh mot dong. */
export const GOP_DOC_MS = 30 * 60_000;

/** Phan chung cua moi su kien gan mot luot: ai lam, luc nao, luot nao, va che do cuon ngay luc ghi. */
type BookEvent = { actorId: string; at: Date; bookId: string; roundId: string; mode: BookMode };
/** Su kien gan ca cuon, khong gan luot (hay luot tuy chon, voi doi-bia va doi-nhac). */
type SachEvent = { actorId: string; at: Date; bookId: string; mode: BookMode };

/**
 * Mot su kien cua dong Hoat dong. Kieu buoc moi loai co dung cac cot cua no, giong cac CHECK cua bang activity:
 * loai gan niem phong phai co sealId; dang-trang co sealId khi lan dang kem cau do hay hen gio; hoi-dap bam luot, khong
 * bao gio gan niem phong; doi-mat-khau chi co nguoi doi va nguoi bi doi; tha-tam-trang chi co nguoi tha va tam trang;
 * gui-thu chi co nguoi gui va thang; cac loai co detail mang dung hinh cua src/lib/feed/detail.ts. Sau loai cua sach viet
 * cung (5c): bon loai de nghi va tra loi gan ca cuon, doi-ten-luot gan luot.
 */
export type ActivityEvent =
  | (BookEvent & { kind: "dang-trang"; sealId: string | null })
  | (BookEvent & { kind: "hoi-dap"; sealId: null })
  | (BookEvent & { kind: LoaiNiemPhong; sealId: string })
  | (BookEvent & { kind: "sua-trang" })
  | (BookEvent & { kind: "da-doc"; detail: ChiTietDaDoc })
  | (SachEvent & { kind: "tao-sach" })
  | (SachEvent & { kind: "doi-ten-sach"; detail: ChiTietTen })
  | (SachEvent & { kind: "doi-bia"; roundId: string | null; detail: ChiTietBia })
  | (SachEvent & { kind: "doi-nhac"; roundId: string | null; detail: ChiTietNhac })
  | (SachEvent & { kind: "moi-viet" | "xin-viet" | "de-nghi-xoa" })
  | (SachEvent & { kind: "nhan-viet"; detail: ChiTietNhanViet })
  | (SachEvent & { kind: "tu-choi"; detail: ChiTietTuChoi })
  | (BookEvent & { kind: "doi-ten-luot"; detail: ChiTietTenLuot })
  | { kind: "tha-tam-trang"; actorId: string; at: Date; moodId: string }
  | { kind: "gui-thu"; actorId: string; at: Date; detail: ChiTietThu }
  | { kind: "doi-mat-khau"; actorId: string; subjectId: string; at: Date };

/**
 * Ghi mot su kien bang giao dich cua chinh hanh dong, nen hanh dong rollback thi su kien cung mat.
 * tx la giao dich dang chay: khong bao gio goi readSnapshot hay mot ham doc qua no tu day.
 */
export async function recordActivity(tx: AnyDb, event: ActivityEvent): Promise<void> {
  if (event.kind === "doi-mat-khau") {
    await tx.insert(activity).values({ ...event, shared: false });
    return;
  }
  // Tam trang von hien voi nguoi kia (dai troi), thu thi gui cho nguoi kia: dong cua hai loai nay luon chia se.
  if (event.kind === "tha-tam-trang" || event.kind === "gui-thu") {
    await tx.insert(activity).values({ ...event, shared: true });
    return;
  }
  const { mode, ...rest } = event;
  await tx.insert(activity).values({ ...rest, shared: mode === "chia-se" });
}

/** Cac loai ghi qua ghiHayGop. */
export type SuKienGop = Extract<ActivityEvent, { kind: "doi-ten-sach" | "doi-bia" | "doi-nhac" | "sua-trang" | "da-doc" }>;

/**
 * Ghi mot su kien, hay gop vao dong cung loai cua cung nguoi o cung cuon (doi bia, doi nhac, sua trang: cung o, cung
 * luot) con trong cua so cuaSoMs: dong do nhan at moi (nen lai la Moi voi nguoi kia) va gia tri sau moi, giu gia tri
 * truoc cua lan dau. Doi roi doi lai nhu cu thi xoa dong: khong co gi doi de bao. da-doc giu trang xa nhat va luot
 * cua trang do. Khoa dong cu (FOR UPDATE) de hai lan ghi cung luc khong gop chong nhau.
 */
export async function ghiHayGop(tx: AnyDb, event: SuKienGop, cuaSoMs: number): Promise<void> {
  const theoO = event.kind === "doi-bia" || event.kind === "doi-nhac" || event.kind === "sua-trang";
  const [cu] = await tx
    .select({ id: activity.id, detail: activity.detail })
    .from(activity)
    .where(and(
      eq(activity.actorId, event.actorId),
      eq(activity.kind, event.kind),
      eq(activity.bookId, event.bookId),
      theoO ? (event.roundId === null ? isNull(activity.roundId) : eq(activity.roundId, event.roundId)) : undefined,
      gt(activity.at, new Date(event.at.getTime() - cuaSoMs)),
    ))
    .orderBy(desc(activity.at))
    .limit(1)
    .for("update");
  if (!cu) {
    await recordActivity(tx, event);
    return;
  }
  const cuaDong = eq(activity.id, cu.id);
  switch (event.kind) {
    case "sua-trang":
      await tx.update(activity).set({ at: event.at }).where(cuaDong);
      return;
    case "da-doc": {
      const cuDen = docChiTietDaDoc(cu.detail)?.den ?? 0;
      const xaHon = event.detail.den >= cuDen;
      await tx
        .update(activity)
        .set({ at: event.at, detail: { den: Math.max(cuDen, event.detail.den) }, ...(xaHon ? { roundId: event.roundId } : {}) })
        .where(cuaDong);
      return;
    }
    case "doi-ten-sach": {
      const truoc = docChiTietTen(cu.detail)?.truoc ?? event.detail.truoc;
      await gopDoi(tx, cu.id, event.at, truoc, event.detail.sau);
      return;
    }
    case "doi-bia": {
      const truoc = docChiTietBia(cu.detail)?.truoc;
      await gopDoi(tx, cu.id, event.at, truoc === undefined ? event.detail.truoc : truoc, event.detail.sau);
      return;
    }
    case "doi-nhac": {
      const truoc = docChiTietNhac(cu.detail)?.truoc;
      await gopDoi(tx, cu.id, event.at, truoc === undefined ? event.detail.truoc : truoc, event.detail.sau);
      return;
    }
    default: {
      const khongCo: never = event;
      throw new Error(`loai gop la: ${String(khongCo)}`);
    }
  }
}

/** Gop mot lan doi: gia tri sau bang gia tri truoc (doi roi doi lai) thi xoa dong, khong thi cap nhat. */
async function gopDoi<T extends ChiTietTen["truoc"] | ChiTietBia["truoc"] | ChiTietNhac["truoc"]>(
  tx: AnyDb, id: string, at: Date, truoc: T, sau: T,
): Promise<void> {
  if (giongNhau(truoc, sau)) {
    await tx.delete(activity).where(eq(activity.id, id));
    return;
  }
  await tx.update(activity).set({ at, detail: { truoc, sau } }).where(eq(activity.id, id));
}
