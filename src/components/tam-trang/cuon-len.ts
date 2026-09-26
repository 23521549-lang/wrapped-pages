import { giamChuyenDong } from "./hieu-ung-chung";

/** Nhip ngan sau khi cuon toi dinh roi moi doi troi: mat kip dung lai tren dai troi truoc khi no bat dau loang. */
export const NHIP_SAU_CUON_MS = 300;

/** Hen du phong khi trinh duyet khong ban `scrollend` (Safari cu): mot lan cuon muot hiem khi lau hon the. */
export const CUON_TOI_DA_MS = 1200;

/**
 * Cuon trang len dinh, noi dai troi nam, roi goi `xong` sau mot nhip ngan (spec bo sung B5: bam "Thả" thi trang cuon
 * muot len dai troi, toi noi roi troi moi doi). Dang o dinh san thi chi cho nhip. Giam chuyen dong thi nhay thang toi
 * dinh va goi `xong` ngay, khong cho gi. Tra ve ham huy: goi khi thanh phan go ra, hay khi mot lan tha moi thay lan nay.
 */
export function cuonLenDinh(xong: () => void): () => void {
  let hen: ReturnType<typeof setTimeout> | undefined;
  let daToi = false;
  const toiNoi = () => {
    if (daToi) return;
    daToi = true;
    globalThis.removeEventListener("scrollend", toiNoi);
    clearTimeout(hen);
    hen = setTimeout(xong, NHIP_SAU_CUON_MS);
  };
  const huy = () => {
    daToi = true;
    globalThis.removeEventListener("scrollend", toiNoi);
    clearTimeout(hen);
  };

  if (giamChuyenDong()) {
    globalThis.scrollTo({ top: 0 });
    xong();
    return huy;
  }
  if (globalThis.scrollY <= 1) {
    toiNoi();
    return huy;
  }
  globalThis.addEventListener("scrollend", toiNoi);
  hen = setTimeout(toiNoi, CUON_TOI_DA_MS);
  globalThis.scrollTo({ top: 0, behavior: "smooth" });
  return huy;
}
