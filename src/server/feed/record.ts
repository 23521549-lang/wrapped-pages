import { activity } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import type { BookMode } from "@/lib/book";
import type { ChiTietBia, ChiTietDaDoc, ChiTietNhac, ChiTietTen } from "@/lib/feed/detail";
import type { LoaiNiemPhong } from "@/lib/feed/types";

/** Phan chung cua moi su kien gan mot luot: ai lam, luc nao, luot nao, va che do cuon ngay luc ghi. */
type BookEvent = { actorId: string; at: Date; bookId: string; roundId: string; mode: BookMode };
/** Su kien gan ca cuon, khong gan luot (hay luot tuy chon, voi doi-bia va doi-nhac). */
type SachEvent = { actorId: string; at: Date; bookId: string; mode: BookMode };

/**
 * Mot su kien cua dong Hoat dong. Kieu buoc moi loai co dung cac cot cua no, giong cac CHECK cua bang activity:
 * loai gan niem phong phai co sealId; dang-trang co sealId khi lan dang kem cau do hay hen gio; hoi-dap bam luot, khong
 * bao gio gan niem phong; doi-mat-khau chi co nguoi doi va nguoi bi doi; tha-tam-trang chi co nguoi tha va tam trang;
 * bon loai co detail mang dung hinh cua src/lib/feed/detail.ts.
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
  | { kind: "tha-tam-trang"; actorId: string; at: Date; moodId: string }
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
  // Tam trang von hien voi nguoi kia (dai troi), nen dong cua no luon chia se.
  if (event.kind === "tha-tam-trang") {
    await tx.insert(activity).values({ ...event, shared: true });
    return;
  }
  const { mode, ...rest } = event;
  await tx.insert(activity).values({ ...rest, shared: mode === "chia-se" });
}
