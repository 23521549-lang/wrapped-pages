import { giamChuyenDong } from "./hieu-ung-chung";

/**
 * Cho sau khi trang da luot toi dinh roi dai troi moi doi (chu du an 26/09: "khi da len dau roi thi sau khoang 3 giay moi
 * doi dai troi"). Khoang nghi nay de mat kip dung lai tren bau troi cu truoc khi no loang sang troi moi.
 */
export const NHIP_SAU_CUON_MS = 3000;

/** Thoi gian luot len dinh: ngan nhat va dai nhat; o giua thi mot khoang goc cong them theo tung diem anh quang duong. */
export const LUOT_NGAN_NHAT_MS = 1400;
export const LUOT_DAI_NHAT_MS = 2600;
const LUOT_GOC_MS = 1000;
const MS_MOI_DIEM_ANH = 0.45;

/**
 * Thoi gian luot tu do cao `quang` diem anh len dinh: cang xa cang lau nhung luon trong khoang tu tu, du xa toi dau cung
 * khong vut qua (chu du an: "luot len mot cach nhe nhang va cham rai", thay cho cu cuon muot mac dinh cua trinh duyet,
 * vua nhanh vua khong chinh duoc).
 */
export function thoiGianLuot(quang: number): number {
  return Math.min(LUOT_DAI_NHAT_MS, Math.max(LUOT_NGAN_NHAT_MS, LUOT_GOC_MS + quang * MS_MOI_DIEM_ANH));
}

/** Nhip vao ra nhe (sin): khoi hanh cham, giua nhanh vua, dat xuong cham. */
export function nhipEm(t: number): number {
  return (1 - Math.cos(Math.PI * Math.min(1, Math.max(0, t)))) / 2;
}

/** Nguoi dung tu cuon hay bam phim trong luc dang luot: nhuong ngay cho ho, khong keo trang nguoc lai. */
const SU_KIEN_NGAT = ["wheel", "touchstart", "keydown", "pointerdown"] as const;

/**
 * Luot trang len dinh, noi dai troi nam, tu tu bang tay (moi khung hinh mot buoc scrollTo, nhip vao ra sin), roi goi
 * `xong` sau NHIP_SAU_CUON_MS. Dang o dinh san thi chi cho nhip. Nguoi dung tu cuon, cham hay bam phim giua duong thi
 * dung luot ngay va coi nhu da toi. Giam chuyen dong thi nhay thang toi dinh (khong co chuyen dong nao), roi cung cho nhip
 * do: khoang nghi khong phai chuyen dong. Tra ve ham huy: goi khi thanh phan go ra, hay khi mot lan tha moi thay lan nay.
 *
 * Trong luc luot, trang duoc giu cao it nhat bang cho dang dung cong mot khung nhin. Hop "Thả tâm trạng" dong ngay trong
 * cu bam, nen trang ngan lai; o ke it sach, trang ngan toi muc trinh duyet kep vi tri cuon ve dinh ngay khung hinh sau,
 * tuc trang NHAY len chu khong luot. Toi noi thi tra lai chieu cao that: luc do dang o dinh, phan bi cat nam ngoai khung
 * nhin, khong gi xo dich.
 */
export function cuonLenDinh(xong: () => void): () => void {
  let hen: ReturnType<typeof setTimeout> | undefined;
  let khung = 0;
  let daToi = false;
  const goc = document.documentElement;
  const caoCu = goc.style.minHeight;
  const boGiu = () => {
    for (const ten of SU_KIEN_NGAT) globalThis.removeEventListener(ten, toiNoi);
    cancelAnimationFrame(khung);
    goc.style.minHeight = caoCu;
  };
  function toiNoi() {
    if (daToi) return;
    daToi = true;
    boGiu();
    hen = setTimeout(xong, NHIP_SAU_CUON_MS);
  }
  const huy = () => {
    if (!daToi) boGiu();
    daToi = true;
    clearTimeout(hen);
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
  goc.style.minHeight = `${tu + globalThis.innerHeight}px`;
  const dai = thoiGianLuot(tu);
  let batDau = -1;
  const buoc = (luc: number) => {
    if (batDau < 0) batDau = luc;
    const t = (luc - batDau) / dai;
    globalThis.scrollTo(0, Math.round(tu * (1 - nhipEm(t))));
    if (t >= 1) toiNoi();
    else khung = requestAnimationFrame(buoc);
  };
  for (const ten of SU_KIEN_NGAT) globalThis.addEventListener(ten, toiNoi, { passive: true });
  khung = requestAnimationFrame(buoc);
  return huy;
}
