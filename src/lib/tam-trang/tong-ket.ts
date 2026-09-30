import { thangVuaKhep } from "@/lib/thu";
import { phanThang, thangKhoa, type NgayLich } from "./lich";
import { TROI, WEATHERS, type Weather } from "./troi";

/*
 * Tong ket mot thang tren Lich hoa (dot nam 5b, spec D): so lieu cua moi nguoi, ngay hai nguoi cung mot troi va cau
 * danh gia theo luat. Ham thuan tren ket qua gomLich, nen may chu va test ra cung mot chu. Phan 5e se de linh vat viet
 * them; o day chi co luat.
 */

/** Ba nhom troi cua cau danh gia. */
export type NhomTroi = "nang" | "diu" | "mua";

export const NHOM_TROI: Record<Weather, NhomTroi> = {
  "nang-am": "nang", "troi-trong": "nang", "cau-vong": "nang", "gio-thoang": "nang",
  "may-nhe": "diu", "suong-mu": "diu",
  "mua-phun": "mua", "mua-rao": "mua", giong: "mua",
};

/** Nhom chiem tu ti le nay tro len thi mo ta ca thang theo nhom ("nắng gần cả tháng"). */
const TI_LE_CA_THANG = 0.7;
/** Duoi so bong nay thi chi "ít thả". */
const IT_THA = 5;

const CA_THANG: Record<NhomTroi, string> = { nang: "nắng gần cả tháng", diu: "mây sương gần cả tháng", mua: "mưa gần cả tháng" };
const NHOM_THU_TU: readonly NhomTroi[] = ["nang", "diu", "mua"];

export type HoaDem = { weather: Weather; ngay: number };
/** Chuoi ngay tha lien dai nhat: so ngay, tu ngay, toi ngay (ngay trong thang). */
export type ChuoiNgay = { dai: number; tu: number; den: number };

export type TongKetNguoi = {
  bong: number;
  /** Ba loai hoa nhieu nhat, nhieu truoc; bang nhau thi theo thu tu WEATHERS. */
  hoa: HoaDem[];
  chuoi: ChuoiNgay | null;
  /** Mo ta ngan: "nắng gần cả tháng", "hay mưa phùn", "nhiều mây nhẹ", "ít thả", "chưa thả bông nào". */
  moTa: string;
};

export type TongKetThang = {
  kia: TongKetNguoi;
  minh: TongKetNguoi;
  /** Ngay ca hai tha cung mot kieu troi, theo thu tu ngay. */
  cungTroi: { ngay: number; weather: Weather }[];
  /** Hoa nhieu nhat cua moi nguoi, cho dong tom tat. */
  noiBat: { kia: Weather | null; minh: Weather | null };
  danhGia: string;
  /** "26 bông, 10 ngày cùng một trời, cùng thấy cầu vồng ngày 13". */
  phu: string;
};

/** Dem so ngay cua moi kieu troi, xep nhieu truoc, bang nhau theo thu tu WEATHERS. */
function demHoa(troi: readonly Weather[]): HoaDem[] {
  return WEATHERS.map((weather) => ({ weather, ngay: troi.filter((w) => w === weather).length }))
    .filter((h) => h.ngay > 0)
    // oxlint-disable-next-line unicorn/no-array-sort -- mang vua tao; toSorted can lib ES2023, du an dang o ES2022.
    .sort((a, b) => b.ngay - a.ngay);
}

function chuoiDaiNhat(ngay: readonly number[]): ChuoiNgay | null {
  let tot: ChuoiNgay | null = null;
  let tu = 0;
  ngay.forEach((d, i) => {
    if (i === 0 || d !== ngay[i - 1] + 1) tu = d;
    const dai = d - tu + 1;
    if (tot === null || dai > tot.dai) tot = { dai, tu, den: d };
  });
  return tot;
}

function moTa(bong: number, hoa: readonly HoaDem[]): string {
  if (bong === 0) return "chưa thả bông nào";
  if (bong < IT_THA) return "ít thả";
  const dem = (n: NhomTroi) => hoa.filter((h) => NHOM_TROI[h.weather] === n).reduce((s, h) => s + h.ngay, 0);
  const nhom = NHOM_THU_TU.reduce((a, b) => (dem(b) > dem(a) ? b : a));
  if (dem(nhom) / bong >= TI_LE_CA_THANG) return CA_THANG[nhom];
  const nhat = hoa[0].weather;
  return `${NHOM_TROI[nhat] === "mua" ? "hay" : "nhiều"} ${TROI[nhat].ten.toLowerCase()}`;
}

function nguoi(cua: readonly [number, Weather][]): TongKetNguoi {
  const hoa = demHoa(cua.map(([, w]) => w));
  return { bong: cua.length, hoa: hoa.slice(0, 3), chuoi: chuoiDaiNhat(cua.map(([d]) => d)), moTa: moTa(cua.length, hoa) };
}

/** "13", "13 và 20", "1, 2 và 3". */
function noiNgay(ds: readonly number[]): string {
  return ds.length === 1 ? String(ds[0]) : `${ds.slice(0, -1).join(", ")} và ${ds[ds.length - 1]}`;
}

/** Tong ket mot thang tu lich da gom (gomLich), nhin tu phia nguoi xem; tenKia la biet danh hien tai cua nguoi kia. */
export function tongKetThang(lich: Readonly<Record<number, NgayLich>>, tenKia: string): TongKetThang {
  // oxlint-disable-next-line unicorn/no-array-sort -- mang vua tao; toSorted can lib ES2023, du an dang o ES2022.
  const ngay = Object.keys(lich).map(Number).sort((a, b) => a - b);
  const cua = (ai: "kia" | "minh") =>
    ngay.flatMap((d): [number, Weather][] => {
      const h = lich[d][ai];
      return h === null ? [] : [[d, h.weather]];
    });
  const kia = nguoi(cua("kia"));
  const minh = nguoi(cua("minh"));
  const cungTroi = ngay.flatMap((d) => {
    const { kia: k, minh: m } = lich[d];
    return k !== null && m !== null && k.weather === m.weather ? [{ ngay: d, weather: k.weather }] : [];
  });

  let danhGia: string;
  if (kia.bong === 0 && minh.bong === 0) danhGia = "Tháng này chưa ai thả tâm trạng";
  else if (kia.moTa === minh.moTa) danhGia = `Cả hai ${minh.moTa}`;
  else danhGia = `Bạn ${minh.moTa}, ${tenKia} ${kia.moTa}`;

  const vong = cungTroi.filter((c) => c.weather === "cau-vong").map((c) => c.ngay);
  const phu = [
    `${kia.bong + minh.bong} bông`,
    cungTroi.length === 0 ? "chưa có ngày nào cùng một trời" : `${cungTroi.length} ngày cùng một trời`,
    ...(vong.length === 0 ? [] : [`cùng thấy cầu vồng ngày ${noiNgay(vong)}`]),
  ].join(", ");

  return {
    kia, minh, cungTroi,
    noiBat: { kia: kia.hoa[0]?.weather ?? null, minh: minh.hoa[0]?.weather ?? null },
    danhGia, phu,
  };
}

/**
 * Cac thang co o tong ket tren Lich hoa: thang da khep co tam trang hay thu (khoa YYYY-MM), cong thang vua khep (dong nhac
 * o Ke sach dan toi o cua no de viet thu). Moi nhat truoc, khong trung; khoa sai dang hay thang chua khep thi bo.
 */
export function thangCoTongKet(khoa: Iterable<string>, now: Date): string[] {
  const vuaKhep = thangKhoa(thangVuaKhep(now));
  const ra = new Set([vuaKhep]);
  for (const k of khoa) if (phanThang(k) !== null && k <= vuaKhep) ra.add(k);
  // oxlint-disable-next-line unicorn/no-array-sort -- mang vua tao; toSorted can lib ES2023, du an dang o ES2022.
  return [...ra].sort((x, y) => (x < y ? 1 : x > y ? -1 : 0));
}
