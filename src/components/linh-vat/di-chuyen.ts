/*
 * Engine di chuyen cua Chip (ham thuan, khong import React): chon diem den tren 4 dai mep man hinh, duong di Bezier
 * om canh, banking theo van toc. Tai dung engine da duyet o demo v4 (freeSpot 14 lan thu + fallback goc, startMove
 * Bezier, toc do 160px/s, nghi 1,4-4,2 giay, tho +-1,5%, nhay moi 6-11 giay, 25% noi cau dao choi sau khi dau), chi thu
 * hep mien lay mau tu toan san khau xuong 4 dai mep va tinh them banking theo truc doc.
 *
 * Toa do: goc tren trai man hinh la (0, 0), x tang sang phai, y tang xuong duoi. Diem la goc tren trai cua khung Chip
 * (khung vuong canh `co`). Dai mep tren: y = le; dai mep duoi: y = cao - le - co; dai mep trai: x = le; dai mep
 * phai: x = rong - le - co.
 */

/** Diem tren man hinh (goc tren trai cua khung Chip). */
export type Diem = { x: number; y: number };

/** Hinh chu nhat cam (vung an toan): Chip khong duoc dau trong do (da cong dem). */
export type HinhChuNhat = { x: number; y: number; rong: number; cao: number };

/** Mot canh man hinh. */
export type Canh = "tren" | "duoi" | "trai" | "phai";

/** Mot doan duong Bezier bac hai: tu (x0, y0) qua diem dieu khien (cx, cy) toi (x1, y1). */
export type DoanDuong = {
  x0: number;
  y0: number;
  cx: number;
  cy: number;
  x1: number;
  y1: number;
  /** Do dai uoc luong (doan thang noi hai dau) dung de chia thoi gian. */
  dai: number;
  /** Thoi gian di het doan, tinh theo toc do 160px/s. */
  thoiGian: number;
};

/** Toc do di chuyen (bible §5, demo v4). */
export const TOC_DO_PX_S = 160;
/** Co khung Chip luc di (token --lv-co) va le mep (token --lv-le): dung chung cho component va engine. */
export const CO_CHIP_PX = 64;
export const LE_CHIP_PX = 16;
/** Thoi gian di toi thieu cho ca chuyen di (demo v4: max(900, len/0.16)). */
export const THOI_GIAN_DI_TOI_THIEU_MS = 900;
/** Nghi sau moi lan dau: 1400 + ngau nhien * 2800 ms (demo v4). */
export const NGHI_TU_MS = 1400;
export const NGHI_DEN_MS = 4200;
/** So lan thu chon diem den toi da truoc khi ve goc (demo v4: 14). */
export const SO_LAN_THU_TOI_DA = 14;
/** Dem quanh vung cam khi kiem tra diem den (demo v4: 24px). */
export const DEM_VUNG_CAM_PX = 24;
/** Do lech ngau nhien cua diem dieu khien khoi duong thang (giu duong di trong dai mep). */
export const LECH_DIEU_KHIEN_PX = 12;
/** Man hep hon muc nay thi tat di chuyen (D1). */
export const NGUONG_MAN_HEP_PX = 600;
/** Goc nghieng toi da khi di (demo v4: ±13 do). */
export const GOC_BANKING_TOI_DA_DO = 13;
/** Co gian toi da theo toc do (demo v4: 0.13). */
export const CO_GIAN_TOI_DA = 0.13;
/** Bien do tho luc nghi: scale +-1,5% (demo v4). */
export const THO_BIEN_DO = 0.015;
/** Nhay chan sao luc nghi: cao 18px trong 450ms (demo v4). */
export const NHAY_CAO_PX = 18;
export const NHAY_MS = 450;
/** Nhay moi 6-11 giay (demo v4). */
export const NHAY_CHU_KY_TU_MS = 6000;
export const NHAY_CHU_KY_DEN_MS = 11000;

const kep = (v: number, nho: number, lon: number) => Math.min(lon, Math.max(nho, v));

/** Goc duoi trai: vi tri nghi mac dinh cua Chip (cung la fallback khi chon diem den that bai). */
export function diemGoc(rong: number, cao: number, co: number, le: number): Diem {
  return { x: le, y: cao - le - co };
}

/** Canh gan nhat voi diem (tinh theo khoang cach tu khung Chip toi moi canh). */
export function canhCuaDiem(d: Diem, rong: number, cao: number, co: number): Canh {
  const cach: [Canh, number][] = [
    ["tren", d.y],
    ["duoi", cao - (d.y + co)],
    ["trai", d.x],
    ["phai", rong - (d.x + co)],
  ];
  let tot: Canh = "duoi";
  let nhoNhat = Number.POSITIVE_INFINITY;
  for (const [canh, kc] of cach) {
    if (kc < nhoNhat) {
      nhoNhat = kc;
      tot = canh;
    }
  }
  return tot;
}

/** Diem co nam trong mot trong 4 dai mep khong (cong them dung sai). */
export function oTrongDaiMep(d: Diem, rong: number, cao: number, co: number, le: number, dungSai = 0): boolean {
  return d.x <= le + co + dungSai || d.x >= rong - le - co - dungSai || d.y <= le + co + dungSai || d.y >= cao - le - co - dungSai;
}

/** Diem co nam trong vung giua man hinh khong (vung trung tam, moi ben thut vao `tiLe` lan kich thuoc). */
export function oGiuaManHinh(x: number, y: number, rong: number, cao: number, tiLe = 0.3): boolean {
  return x > rong * tiLe && x < rong * (1 - tiLe) && y > cao * tiLe && y < cao * (1 - tiLe);
}

const giaoNhau = (a: HinhChuNhat, b: HinhChuNhat) =>
  a.x < b.x + b.rong && b.x < a.x + a.rong && a.y < b.y + b.cao && b.y < a.y + a.cao;

/**
 * Chon diem den ngau nhien tren chu vi 4 dai mep, loai cac vung cam (da cong dem). Thu toi da 14 lan nhu demo v4,
 * het lan thi ve goc duoi trai. `ngauNhien` cho phep test truyen ham xac dinh.
 */
export function chonDiemDen(
  rong: number,
  cao: number,
  co: number,
  le: number,
  vungCam: readonly HinhChuNhat[],
  ngauNhien: () => number = Math.random,
): Diem {
  const goc = diemGoc(rong, cao, co, le);
  const docDai = Math.max(0, rong - 2 * le - co);
  const docCao = Math.max(0, cao - 2 * le - co);
  const cacCanh: Canh[] = ["tren", "duoi", "trai", "phai"];
  for (let lan = 0; lan < SO_LAN_THU_TOI_DA; lan += 1) {
    const canh = cacCanh[Math.floor(ngauNhien() * cacCanh.length)] ?? "duoi";
    let ung: Diem;
    if (canh === "tren") ung = { x: le + ngauNhien() * docDai, y: le };
    else if (canh === "duoi") ung = { x: le + ngauNhien() * docDai, y: cao - le - co };
    else if (canh === "trai") ung = { x: le, y: le + ngauNhien() * docCao };
    else ung = { x: rong - le - co, y: le + ngauNhien() * docCao };
    const khung: HinhChuNhat = { x: ung.x, y: ung.y, rong: co, cao: co };
    const vuot = vungCam.some((v) =>
      giaoNhau(khung, {
        x: v.x - DEM_VUNG_CAM_PX,
        y: v.y - DEM_VUNG_CAM_PX,
        rong: v.rong + 2 * DEM_VUNG_CAM_PX,
        cao: v.cao + 2 * DEM_VUNG_CAM_PX,
      }),
    );
    if (!vuot) return ung;
  }
  return goc;
}

/** Goc cua hai canh ke nhau (vd tren + phai = goc tren phai). */
function gocChung(a: Canh, b: Canh, rong: number, cao: number, co: number, le: number): Diem {
  const x = a === "phai" || b === "phai" ? rong - le - co : le;
  const y = a === "duoi" || b === "duoi" ? cao - le - co : le;
  return { x, y };
}

/** Hai canh co ke nhau khong (chia se mot goc). */
function keNhau(a: Canh, b: Canh): boolean {
  return (a === "tren" || a === "duoi") !== (b === "tren" || b === "duoi");
}

/**
 * Diem dieu khien cho mot doan tren cung mot duong mep: trung diem cong lech vuong goc nho (duong di hoi luon
 * trong dai mep). Hai dau luon cung x hoac cung y vi moi cap moc ke nhau chia se mot canh (goc la moc trung
 * gian, khong phai diem dieu khien). Cap cheo (phong thu) thi lech theo x nhu doan doc.
 * Diem dieu khien luon kep trong khung man hinh.
 */
function diemDieuKhienDoan(
  p: Diem,
  q: Diem,
  rong: number,
  cao: number,
  co: number,
  le: number,
  ngauNhien: () => number,
): Diem {
  const giua = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
  const lech = (ngauNhien() * 2 - 1) * LECH_DIEU_KHIEN_PX;
  let dieu: Diem;
  if (p.y === q.y) {
    // Cung duong ngang (mep tren hoac duoi): lech len/xuong.
    dieu = { x: giua.x, y: giua.y + lech };
  } else {
    // Cung duong doc (mep trai hoac phai): lech trai/phai.
    dieu = { x: giua.x + lech, y: giua.y };
  }
  return { x: kep(dieu.x, le, rong - le - co), y: kep(dieu.y, le, cao - le - co) };
}

/** Do dai doan thang (dung uoc luong thoi gian di). */
const daiDoan = (p: Diem, q: Diem) => Math.hypot(q.x - p.x, q.y - p.y);

/** Dai mep cua mot canh (vung di chuyen cua Chip doc canh do). */
function daiMepCanh(canh: Canh, rong: number, cao: number, co: number, le: number): HinhChuNhat {
  if (canh === "tren") return { x: le, y: le, rong: rong - 2 * le - co, cao: co };
  if (canh === "duoi") return { x: le, y: cao - le - co, rong: rong - 2 * le - co, cao: co };
  if (canh === "trai") return { x: le, y: le, rong: co, cao: cao - 2 * le - co };
  return { x: rong - le - co, y: le, rong: co, cao: cao - 2 * le - co };
}

/** Mot canh co bi vung cam chan het khong (dai mep cua no giao voi mot vung cam da cong dem). */
function canhBiChan(canh: Canh, rong: number, cao: number, co: number, le: number, vungCam: readonly HinhChuNhat[]): boolean {
  const dai = daiMepCanh(canh, rong, cao, co, le);
  return vungCam.some((v) =>
    giaoNhau(dai, {
      x: v.x - DEM_VUNG_CAM_PX,
      y: v.y - DEM_VUNG_CAM_PX,
      rong: v.rong + 2 * DEM_VUNG_CAM_PX,
      cao: v.cao + 2 * DEM_VUNG_CAM_PX,
    }),
  );
}

/**
 * Duong di tu `tu` toi `den` om sat chu vi: cung canh thi mot doan thang (hoi luon), hai canh ke thi hai doan qua
 * goc chung (moi doan om mot canh), hai canh doi nhau thi ba doan di men theo mot ben (qua hai goc cua ben do) de
 * khong cat ngang vung giua man hinh. Ben men theo duoc chon tranh vung cam (`vungCam`): vd mep tren luon bi nav
 * (nav chan het mep tren, khung nhac chi chan mot goc mep duoi), chuyen doc giu ngau nhien. Goc chung cua hai canh
 * ke khong xet o day (doan qua goc ngan, luoi an khi giao nhau luc dang di se tam an Chip neu can).
 * Thoi gian toan chuyen = max(900, tong dai / 0.16), chia theo do dai tung doan.
 */
export function duongDi(
  tu: Diem,
  den: Diem,
  rong: number,
  cao: number,
  co: number,
  le: number,
  ngauNhien: () => number = Math.random,
  vungCam: readonly HinhChuNhat[] = [],
): DoanDuong[] {
  const canhTu = canhCuaDiem(tu, rong, cao, co);
  const canhDen = canhCuaDiem(den, rong, cao, co);
  let moc: Diem[];
  if (canhTu === canhDen) {
    moc = [tu, den];
  } else if (keNhau(canhTu, canhDen)) {
    // Hai canh ke: qua goc chung nhu mot moc trung gian (2 doan, moi doan om mot canh). Dung mot doan cong voi
    // diem dieu khien la goc chung thi duong vong vao giua man hinh khi hai dau xa nhau (vd tu (1200,283) toi
    // (346,720) se di qua (986,610) thay vi men theo mep).
    moc = [tu, gocChung(canhTu, canhDen, rong, cao, co, le), den];
  } else {
    // Hai canh doi nhau: chon mot ben (trai/phai neu di tren-duoi, tren/duoi neu di trai-phai) roi di men theo ben do.
    const doc = canhTu === "tren" || canhTu === "duoi";
    const benUngVien: Canh[] = doc ? ["trai", "phai"] : ["tren", "duoi"];
    const benTrong = benUngVien.filter((b) => !canhBiChan(b, rong, cao, co, le, vungCam));
    let ben: Canh;
    if (benTrong.length === 0) {
      ben = doc ? (ngauNhien() < 0.5 ? "trai" : "phai") : "duoi";
    } else if (benTrong.length === 1) {
      ben = benTrong[0] as Canh;
    } else {
      ben = benTrong[Math.floor(ngauNhien() * benTrong.length)] as Canh;
    }
    const goc1 = gocChung(canhTu, ben, rong, cao, co, le);
    const goc2 = gocChung(canhDen, ben, rong, cao, co, le);
    moc = [tu, goc1, goc2, den];
  }
  const doanTho: { p: Diem; q: Diem }[] = [];
  for (let i = 0; i + 1 < moc.length; i += 1) {
    const p = moc[i] as Diem;
    const q = moc[i + 1] as Diem;
    if (p.x !== q.x || p.y !== q.y) doanTho.push({ p, q });
  }
  if (doanTho.length === 0) return [];
  const tongDai = doanTho.reduce((t, d) => t + daiDoan(d.p, d.q), 0);
  const tongThoiGian = Math.max(THOI_GIAN_DI_TOI_THIEU_MS, tongDai / (TOC_DO_PX_S / 1000));
  return doanTho.map(({ p, q }) => {
    const dai = daiDoan(p, q);
    const dieu = diemDieuKhienDoan(p, q, rong, cao, co, le, ngauNhien);
    return { x0: p.x, y0: p.y, cx: dieu.x, cy: dieu.y, x1: q.x, y1: q.y, dai, thoiGian: (tongThoiGian * dai) / tongDai };
  });
}

/** Diem tren duong cong Bezier bac hai tai t (0..1). */
export function bezier(a: number, c: number, b: number, t: number): number {
  const u = 1 - t;
  return u * u * a + 2 * u * t * c + t * t * b;
}

/** Easing ease-in-out dang bac hai (demo v4). */
export function ease(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/** Thoi gian di mot doan thang dai `daiPx` (demo v4: max(900, len/0.16)). */
export function thoiGianDi(daiPx: number): number {
  return Math.max(THOI_GIAN_DI_TOI_THIEU_MS, daiPx / (TOC_DO_PX_S / 1000));
}

/**
 * Duong ve goc nhanh khi neo dau (E1: mo to tro chuyen, dien cam xuc, modal mo, bat tam dung): mot doan thang tu vi
 * tri hien tai ve goc, toc do gap 8 lan toc do dao choi (1280px/s), toi thieu 300ms. Duong ve khong can om canh
 * (chi duong dao choi moi om canh theo A1); ve thang cho kip truoc khi to tro chuyen mo han.
 */
export function duongVeNha(tu: Diem, den: Diem): DoanDuong[] {
  const dai = Math.hypot(den.x - tu.x, den.y - tu.y);
  if (dai < 1) return [];
  const giua = { x: (tu.x + den.x) / 2, y: (tu.y + den.y) / 2 };
  return [{ x0: tu.x, y0: tu.y, cx: giua.x, cy: giua.y, x1: den.x, y1: den.y, dai, thoiGian: Math.max(300, dai / 1.28) }];
}

/** Thoi gian nghi sau mot lan dau: 1400 + ngau nhien * 2800 ms (demo v4). */
export function thoiGianNghi(ngauNhien: () => number = Math.random): number {
  return NGHI_TU_MS + ngauNhien() * (NGHI_DEN_MS - NGHI_TU_MS);
}

/**
 * Banking theo van toc (demo v4, mo rong them truc doc): goc nghieng theo van toc ngang, co gian theo truc chuyen
 * dong chinh (ngang thi gian ngang, doc thi gian doc). Dung yen thi khong nghieng, khong co gian.
 */
export function tinhBanking(vx: number, vy: number): { goc: number; tiLeX: number; tiLeY: number } {
  const tocDo = Math.hypot(vx, vy);
  if (tocDo < 1) return { goc: 0, tiLeX: 1, tiLeY: 1 };
  const k = Math.min(CO_GIAN_TOI_DA, tocDo / 3600);
  const goc = kep(vx * 0.03, -GOC_BANKING_TOI_DA_DO, GOC_BANKING_TOI_DA_DO);
  return Math.abs(vx) >= Math.abs(vy) ? { goc, tiLeX: 1 + k, tiLeY: 1 - k } : { goc, tiLeX: 1 - k, tiLeY: 1 + k };
}

/** He so tho luc nghi tai thoi diem `bayGio` (scale 1 +- 1,5%, demo v4). */
export function heSoTho(bayGio: number): number {
  return 1 + Math.sin(bayGio / 900) * THO_BIEN_DO;
}
