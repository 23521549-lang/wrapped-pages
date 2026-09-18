import { activity } from "@/server/db/schema";
import type { AnyDb } from "@/server/db/types";
import type { BookMode } from "@/lib/book";
import type { FeedKind } from "@/lib/feed/types";

/** Phan chung cua moi su kien gan mot cuon: ai lam, luc nao, khoang to, va che do cuon ngay luc ghi. */
type BookEvent = { actorId: string; at: Date; bookId: string; firstPosition: number; lastPosition: number; mode: BookMode };

/**
 * Mot su kien cua dong Hoat dong. Kieu buoc moi loai co dung cac cot cua no, giong cac CHECK cua bang activity:
 * loai gan niem phong phai co sealId; dang-trang co sealId khi lan dang kem cau do hay hen gio; doi-mat-khau
 * chi co nguoi doi va nguoi bi doi.
 */
export type ActivityEvent =
  | (BookEvent & { kind: "dang-trang"; sealId: string | null })
  | (BookEvent & { kind: Exclude<FeedKind, "dang-trang" | "doi-mat-khau">; sealId: string })
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
  const { mode, ...rest } = event;
  await tx.insert(activity).values({ ...rest, shared: mode === "chia-se" });
}
