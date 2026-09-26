import { giamChuyenDong } from "./hieu-ung-chung";

/**
 * Thoi gian luot len dinh: ngan nhat va dai nhat; o giua thi mot khoang goc cong them theo tung diem anh quang duong.
 * Chu du an 27/09: toc do "giong nhu cuon chuot binh thuong", khong con cham rai: xa toi dau cung khong qua 0,6 giay.
 */
export const LUOT_NGAN_NHAT_MS = 220;
export const LUOT_DAI_NHAT_MS = 600;
const LUOT_GOC_MS = 160;
const MS_MOI_DIEM_ANH = 0.3;

/** Thoi gian luot tu do cao `quang` diem anh len dinh: cang xa cang lau, nhung luon trong khoang cua mot cu cuon chuot. */
export function thoiGianLuot(quang: number): number {
  return Math.min(LUOT_DAI_NHAT_MS, Math.max(LUOT_NGAN_NHAT_MS, LUOT_GOC_MS + quang * MS_MOI_DIEM_ANH));
}

/** Nhip cua mot cu cuon chuot: di nhanh ngay tu dau roi cham dan khi toi noi (ease-out bac ba). */
export function nhipCuon(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return 1 - (1 - x) ** 3;
}

/** Nguoi dung tu cuon hay bam phim trong luc dang luot: nhuong ngay cho ho, khong keo trang nguoc lai. */
const SU_KIEN_NGAT = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/**
 * Luot trang len dinh, noi dai troi nam (moi khung hinh mot buoc scrollTo), roi goi `xong` NGAY khi toi noi: dai troi
 * doi luon. Dang o dinh san thi goi `xong` ngay. Nguoi dung tu cuon, cham hay bam phim giua duong thi dung luot va coi
 * nhu da toi. Giam chuyen dong thi nhay thang toi dinh. Tra ve ham huy: goi khi thanh phan go ra, hay khi mot lan tha
 * moi thay lan nay; da huy thi `xong` khong bao gio chay.
 */
export function cuonLenDinh(xong: () => void): () => void {
  let khung = 0;
  let daToi = false;
  const boNghe = () => {
    for (const ten of SU_KIEN_NGAT) globalThis.removeEventListener(ten, toiNoi);
    cancelAnimationFrame(khung);
  };
  function toiNoi() {
    if (daToi) return;
    daToi = true;
    boNghe();
    xong();
  }
  const huy = () => {
    daToi = true;
    boNghe();
  };

  const tu = globalThis.scrollY;
  if (tu <= 1) {
    toiNoi();
    return huy;
  }
  if (giamChuyenDong()) {
    globalThis.scrollTo({ top: 0 });
    toiNoi();
    return huy;
  }
  const dai = thoiGianLuot(tu);
  let batDau = -1;
  const buoc = (luc: number) => {
    if (batDau < 0) batDau = luc;
    const t = (luc - batDau) / dai;
    globalThis.scrollTo(0, Math.round(tu * (1 - nhipCuon(t))));
    if (t >= 1) toiNoi();
    else khung = requestAnimationFrame(buoc);
  };
  for (const ten of SU_KIEN_NGAT) globalThis.addEventListener(ten, toiNoi, { passive: true });
  khung = requestAnimationFrame(buoc);
  return huy;
}
