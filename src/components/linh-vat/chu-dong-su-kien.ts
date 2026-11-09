import type { LoiChuDong } from "@/server/chip/chu-dong";

/*
 * Su kien trinh duyet: mot loi chu dong vua ve tu may chu. ThaTamTrang (hay bat cu diem goi truc tiep nao) phat su
 * kien sau khi actionChuDongChip tra loi; LinhVat nghe va hien bong bong nhu loi chao.
 */

/** Ten su kien: mot loi chu dong vua ve. */
export const SU_KIEN_CHU_DONG = "chip-chu-dong";

/** Bao cho LinhVat biet co loi chu dong moi ve (goi sau khi actionChuDongChip tra loi, nuot loi goi). */
export function baoChuDong(loi: LoiChuDong): void {
  globalThis.dispatchEvent(new CustomEvent<LoiChuDong>(SU_KIEN_CHU_DONG, { detail: loi }));
}
