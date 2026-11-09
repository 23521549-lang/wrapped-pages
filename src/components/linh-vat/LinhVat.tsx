"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import { actionCamXucChoToi, actionDaXemCamXuc } from "@/app/actions/cam-xuc";
import { actionChaoChip, actionChuDongChip } from "@/app/actions/chip";
import { useTamDung } from "@/components/hieu-ung/tam-dung";
import { msTuCss } from "@/components/reader/Flipbook";
import { CAM_XUC, CHIP, dongMangToi, type LoaiCamXuc } from "@/lib/cam-xuc";
import { tachDam } from "@/lib/chip";
import type { CamXucToi } from "@/server/cam-xuc/cam-xuc";
import type { LoiChuDong } from "@/server/chip/chu-dong";
import type { LoiChao, TrangThaiChip } from "@/server/chip/tro-chuyen";
import { AnhLinhVat } from "./AnhLinhVat";
import {
  bezier,
  chonDiemDen,
  CO_CHIP_PX,
  diemGoc,
  duongDi,
  duongVeNha,
  ease,
  heSoTho,
  LE_CHIP_PX,
  NGUONG_MAN_HEP_PX,
  NHAY_CAO_PX,
  NHAY_CHU_KY_DEN_MS,
  NHAY_CHU_KY_TU_MS,
  NHAY_MS,
  thoiGianNghi,
  tinhBanking,
  type Diem,
  type DoanDuong,
  type HinhChuNhat,
} from "./di-chuyen";
import { SU_KIEN_CHU_DONG } from "./chu-dong-su-kien";
import { dienHieuUng, VANG_MAT } from "./hieu-ung";
import { TroChuyen } from "./TroChuyen";

/** Cac cam xuc da dien tren trinh duyet nay: moi cam xuc chi dien mot lan (5d, spec D1). */
const KHOA_DA_DIEN = "mqce-cam-xuc-da-dien";
/** Chip dang thu nho tren trinh duyet nay (5e, spec F1). */
const KHOA_THU_NHO = "mqce-chip-thu-nho";
/** Lan cuoi Chip tu noi tren trinh duyet nay: hai lan tu noi cach nhau it nhat 10 phut (5e, spec C2). */
const KHOA_NOI_LUC = "mqce-chip-noi-luc";
const CACH_TU_NOI_MS = 10 * 60_000;

function docLuu(khoa: string): unknown {
  try {
    const v = localStorage.getItem(khoa);
    return v === null ? null : (JSON.parse(v) as unknown);
  } catch {
    return null;
  }
}

function ghiLuu(khoa: string, v: unknown): void {
  try {
    localStorage.setItem(khoa, JSON.stringify(v));
  } catch {
    // Trinh duyet chan luu tru: lan sau quen, khong sao.
  }
}

function cacDaDien(): string[] {
  const ds = docLuu(KHOA_DA_DIEN);
  return Array.isArray(ds) ? ds.filter((x): x is string => typeof x === "string") : [];
}

const daDien = (id: string) => cacDaDien().includes(id);
const ghiDaDien = (id: string) => ghiLuu(KHOA_DA_DIEN, [...cacDaDien().filter((x) => x !== id), id].slice(-24));

const giao = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const giamChuyenDong = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/** Vung cam luc chon diem den (C1): khung nhac, la thu, nav, form, o nhap, nut chinh, chi tinh phan dang hien.
 * Nut chinh la .btn dac (khong tinh .btn--quiet/--line/--chu). O nhap an (type=hidden) co khung rong nen tu loai. */
function vungCamHienTai(): HinhChuNhat[] {
  const vung: HinhChuNhat[] = [];
  for (const el of document.querySelectorAll(
    "aside.mph:not([hidden]), .thu-bay:not(.thu-bay--cho):not(.thu-bay--tranh), nav.nav, " +
      "form, input:not([type='hidden']), textarea, select, " +
      ".btn:not(.btn--quiet):not(.btn--line):not(.btn--chu)",
  )) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) vung.push({ x: r.left, y: r.top, rong: r.width, cao: r.height });
  }
  return vung;
}

/** Tieu diem dang trong o nhap (input / textarea / o soan noi dung): luc nay khong nen hien bong bong chu dong. */
const dangGo = () => {
  const el = document.activeElement;
  return el instanceof HTMLElement && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
};
const msToken = (ten: string, macDinh: number) => {
  const ms = msTuCss(getComputedStyle(document.documentElement).getPropertyValue(ten));
  return Number.isFinite(ms) && ms > 0 ? ms : macDinh;
};

/** Bong bong dang noi: ban cam xuc mang cam xuc nguoi kia toi (nhan), hay vua mang cam xuc cua minh di (gui). */
type Dang = { kieu: "nhan"; cx: CamXucToi } | { kieu: "gui"; loai: LoaiCamXuc };

function ChuDam({ cau }: { cau: string }) {
  return <>{tachDam(cau).map((d) => (d.dam ? <b key={d.o}>{d.chu}</b> : <Fragment key={d.o}>{d.chu}</Fragment>))}</>;
}

export type LinhVatProps = { tenMinh: string; tenKia: string; hangDau: CamXucToi[]; trangThai: TrangThaiChip };

/**
 * Chip (dot nam 5d, 5e): ga con ngoi goc duoi ben trai moi trang da dang nhap. Bam Chip mo to tro chuyen (trong do co Kho
 * cam xuc). Cam xuc nguoi kia tha: Chip hoa thanh ban cua cam xuc, noi cau cua nguoi tha, dien hieu ung tren mot lop phu ca
 * man, xuyen chuot (ngoai le chu du an duyet: duoc de len khung YouTube). Chip tu chao khi vao, khi quay lai, khi thuc day
 * (cau co san tu may chu, khong goi AI). Thu nho: ho dau o mep trai. Tat trong Cai dat: khong ngoi goc, nhung cam xuc van
 * duoc mang toi. Ngoi yen thi khong bao gio de len khung YouTube: cham mot khung phat thi tam an.
 */
export function LinhVat({ tenMinh, tenKia, hangDau, trangThai }: LinhVatProps) {
  const [moTc, setMoTc] = useState(false);
  const [hang, setHang] = useState(hangDau);
  const [dang, setDang] = useState<Dang | null>(null);
  const [dien, setDien] = useState<LoaiCamXuc | null>(null);
  const [tranh, setTranh] = useState(false);
  const [bao, setBao] = useState("");
  const [nguDen, setNguDen] = useState(trangThai.nguDen);
  const [thuNho, setThuNho] = useState(false);
  const [loiChao, setLoiChao] = useState<LoiChao | LoiChuDong | null>(null);
  const [dangDi, setDangDi] = useState(false);
  const [reduce, setReduce] = useState(() => giamChuyenDong());
  const [hep, setHep] = useState(() => (typeof window === "undefined" ? false : window.innerWidth < NGUONG_MAN_HEP_PX));
  const gocRef = useRef<HTMLDivElement>(null);
  const nutRef = useRef<HTMLButtonElement>(null);
  const lopRef = useRef<HTMLDivElement>(null);
  const henRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  /** Chuot dang tren bong bong hay focus dang trong no: chua tu dong, doc cho xong. */
  const giuRef = useRef(false);
  /** Trang thai dong co di chuyen (chi trong ref de vong rAF khong gay ve lai moi khung). */
  const viTriRef = useRef<Diem | null>(null);
  const cheDoRef = useRef<"nghi" | "di">("nghi");
  const duongRef = useRef<{ doan: DoanDuong[]; chiSo: number; daDi: number } | null>(null);
  const veNhaRef = useRef(false);
  const nghiDenRef = useRef(0);
  const hopRef = useRef<{ batDau: number | null; denKe: number }>({ batDau: null, denKe: 0 });
  const neoRef = useRef(false);
  /** Anh xa cua `tranh` de vong rAF xet giao nhau ma khong goi setState moi khung. */
  const tranhRef = useRef(false);
  /** Luc xet giao nhau ke tiep luc Chip dang di (moi 250ms, tranh goi querySelectorAll moi khung). */
  const kiemTranhSauRef = useRef(0);

  const sau = (ms: number, f: () => void) => {
    const t = setTimeout(() => {
      henRef.current.delete(t);
      f();
    }, ms);
    henRef.current.add(t);
  };
  useEffect(() => {
    const hen = henRef.current;
    return () => {
      for (const t of hen) clearTimeout(t);
      hen.clear();
    };
  }, []);

  function dongBong() {
    for (const t of henRef.current) clearTimeout(t);
    henRef.current.clear();
    setDien(null);
    setDang(null);
    setLoiChao(null);
  }

  /** Bong bong tu dong sau 8 giay, tru khi nguoi dung dang re chuot hay focus trong no (thi hen lai 2 giay nua). */
  function tuDong() {
    if (giuRef.current) sau(2000, tuDong);
    else dongBong();
  }

  // --- Nhan: dien lan luot hang cho ---
  const batDau = useEffectEvent(() => {
    if (dang !== null) return;
    const [cx, ...conLai] = hang;
    if (cx === undefined) return;
    setHang(conLai);
    if (daDien(cx.id)) return;
    ghiDaDien(cx.id);
    void actionDaXemCamXuc(cx.id).catch(() => {});
    const lv = CAM_XUC[cx.loai];
    // To tro chuyen dang mo thi dong; focus dang trong to thi ve Chip, khong roi ve body.
    if (gocRef.current?.querySelector(".tc")?.contains(document.activeElement)) nutRef.current?.focus();
    setMoTc(false);
    setLoiChao(null);
    setDang({ kieu: "nhan", cx });
    setBao(`${lv.ten} mang tới: ${tenKia} ${lv.cau}.`);
    if (!giamChuyenDong()) {
      setDien(cx.loai);
      sau(msToken("--dur-hieu-ung", 3600), () => setDien(null));
    }
    sau(8000, tuDong);
  });

  useEffect(() => {
    if (dang !== null || hang.length === 0) return;
    const t = setTimeout(() => batDau(), 600);
    return () => clearTimeout(t);
  }, [dang, hang]);

  // Hieu ung: lop phu chi co trong DOM luc dang dien; do tam linh vat o goc lam goc xuat phat.
  useEffect(() => {
    const lop = lopRef.current;
    const nut = gocRef.current?.querySelector(".linh-vat__nut");
    if (dien === null || !lop || !nut) return;
    const r = nut.getBoundingClientRect();
    return dienHieuUng(dien, lop, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, [dien]);

  // Hoi lai hang cho moi 15 giay khi tab dang duoc xem va khong dang dien; tab an thi thoi, xem lai thi hoi ngay.
  const hoi = useEffectEvent(() => {
    if (document.visibilityState !== "visible" || dang?.kieu === "nhan") return;
    void actionCamXucChoToi().then((ds) => setHang(ds.filter((x) => !daDien(x.id))), () => {});
  });
  useEffect(() => {
    const hen = setInterval(hoi, msToken("--dur-hoi-cam-xuc", 15_000));
    const khiXem = () => {
      if (document.visibilityState === "visible") hoi();
    };
    document.addEventListener("visibilitychange", khiXem);
    return () => {
      clearInterval(hen);
      document.removeEventListener("visibilitychange", khiXem);
    };
  }, []);

  // Thu nho nho theo trinh duyet; Chip tu chao mot lan moi lan mo trang (may chu ghi lan cuoi thay web).
  const chao = useEffectEvent((loi: LoiChao | null) => {
    const nho = docLuu(KHOA_THU_NHO) === true;
    setThuNho(nho);
    if (loi === null || nho || trangThai.an || dang !== null) return;
    const luc = docLuu(KHOA_NOI_LUC);
    if (typeof luc === "number" && Date.now() - luc < CACH_TU_NOI_MS) return;
    ghiLuu(KHOA_NOI_LUC, Date.now());
    setLoiChao(loi);
    setBao(tachDam(loi.cau).map((d) => d.chu).join(""));
    sau(8000, tuDong);
  });
  // Hien mot loi chu dong trong bong bong nhu loi chao: cung cooldown 10 phut, cung tat khi thu nho / tat Chip /
  // dang dien cam xuc. Loi da luu vao lich su o may chu roi nen chi viec hien hay khong. Dang go trong o nhap thi
  // khong hien bong bong luc nay (de khoi cat ngang luc dang viet); mo to se thay loi da luu.
  const chuDong = useEffectEvent((loi: LoiChuDong | null) => {
    const nho = docLuu(KHOA_THU_NHO) === true;
    setThuNho(nho);
    if (loi === null) return;
    if (nho || trangThai.an || dang !== null || dangGo()) return;
    const luc = docLuu(KHOA_NOI_LUC);
    if (typeof luc === "number" && Date.now() - luc < CACH_TU_NOI_MS) return;
    ghiLuu(KHOA_NOI_LUC, Date.now());
    setLoiChao(loi);
    setBao(tachDam(loi.cau).map((d) => d.chu).join(""));
    sau(8000, tuDong);
  });

  // Luc mo trang: chao truoc (neu co), khong co loi chao thi hoi chu dong (quet viec moi / trang dang mo).
  useEffect(() => {
    let con = true;
    // Quet chu dong chay doc lap voi loi chao: chi bo qua khi co loi chao that (de khoi ton mot cuoc goi Groq vo
    // ich, vi bong bong chao thang va khoa noi 10 phut se chan bong bong chu dong). Chao reject (vd mang/server
    // chap chon duoi tai) KHONG duoc chan quet: truoc day duong nay chi goi chao(null) roi dung, nen quet khong
    // bao gio chay va khong co cuoc goi Groq nao.
    const quet = () => {
      void actionChuDongChip({ kieu: "quet", duongDan: globalThis.location.pathname }).then((chu) => {
        if (con) chuDong(chu);
      }, () => {});
    };
    void actionChaoChip().then((loi) => {
      if (!con) return;
      if (loi !== null) {
        chao(loi);
        return;
      }
      // Khong co loi chao thi hoi chu dong (quet viec moi / trang dang mo); loi chao thang khi ca hai cung toi.
      quet();
    }, () => {
      if (con) chao(null);
      if (con) quet();
    });
    return () => {
      con = false;
    };
  }, []);

  // Loi chu dong ve tu diem goi truc tiep (vd tha tam trang xong): hien bong bong nhu loi chao.
  useEffect(() => {
    const khiCo = (e: Event) => chuDong((e as CustomEvent<LoiChuDong>).detail);
    globalThis.addEventListener(SU_KIEN_CHU_DONG, khiCo);
    return () => globalThis.removeEventListener(SU_KIEN_CHU_DONG, khiCo);
  }, []);

  // Khong de len khung YouTube khi ngoi yen: dang giao voi mot iframe hay khung phat chung thi tam an. Luc dang dien
  // hieu ung thi duoc de (ngoai le cung lop hieu ung), het hieu ung thi xet lai ngay. Vong di chuyen goi lai ham nay
  // moi 250ms luc dang di (manh 3) vi vi tri Chip doi moi khung, khong cho khoang 1 giay nhu luc ngoi yen.
  const xetTranh = useEffectEvent(() => {
    const goc = gocRef.current;
    if (!goc) return;
    const r = goc.getBoundingClientRect();
    const moi = [...document.querySelectorAll("iframe, aside.mph:not([hidden])")].some((el) => giao(r, el.getBoundingClientRect()));
    if (moi !== tranhRef.current) {
      tranhRef.current = moi;
      setTranh(moi);
    }
  });
  useEffect(() => {
    let khungHinh = 0;
    const hen = () => {
      if (khungHinh === 0) {
        khungHinh = requestAnimationFrame(() => {
          khungHinh = 0;
          xetTranh();
        });
      }
    };
    hen();
    addEventListener("scroll", hen, { passive: true });
    addEventListener("resize", hen);
    const theoDoi = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(hen);
    theoDoi?.observe(document.body);
    const dinhKy = setInterval(hen, 1000);
    return () => {
      cancelAnimationFrame(khungHinh);
      removeEventListener("scroll", hen);
      removeEventListener("resize", hen);
      theoDoi?.disconnect();
      clearInterval(dinhKy);
    };
  }, []);

  // --- Di chuyen doc 4 canh (them sau, de xuat chip-di-chuyen): Chip dao choi doc mep man hinh, ve goc khi neo dau. ---
  const apDungTamDung = useCallback((v: boolean) => {
    if (!v) return;
    // Bat tam dung thi ve goc ngay (E1), truoc ca khi React ve lai.
    const goc = gocRef.current;
    if (goc) goc.style.removeProperty("transform");
    if (typeof window !== "undefined") viTriRef.current = diemGoc(window.innerWidth, window.innerHeight, CO_CHIP_PX, LE_CHIP_PX);
    cheDoRef.current = "nghi";
    duongRef.current = null;
    veNhaRef.current = false;
    setDangDi(false);
  }, []);
  const [tamDung] = useTamDung(apDungTamDung);

  useEffect(() => {
    const mq = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!mq) return;
    const doi = () => setReduce(mq.matches);
    mq.addEventListener("change", doi);
    return () => mq.removeEventListener("change", doi);
  }, []);

  useEffect(() => {
    const doi = () => setHep(window.innerWidth < NGUONG_MAN_HEP_PX);
    doi();
    addEventListener("resize", doi);
    return () => removeEventListener("resize", doi);
  }, []);

  // Neo dau (C1): to tro chuyen mo, bong bong hien, hoac dang dien cam xuc thi Chip dung di chuyen, ve goc.
  useEffect(() => {
    neoRef.current = moTc || dang !== null || loiChao !== null || dien !== null;
  }, [moTc, dang, loiChao, dien]);

  function daTha(loai: LoaiCamXuc) {
    const lv = CAM_XUC[loai];
    setMoTc(false);
    nutRef.current?.focus();
    setLoiChao(null);
    setDang((cu) => (cu?.kieu === "nhan" ? cu : { kieu: "gui", loai }));
    setBao(`${lv.ten} đang mang ${lv.camXuc} tới ${tenKia}.`);
    sau(5000, () => setDang((cu) => (cu?.kieu === "gui" ? null : cu)));
  }

  function doiThuNho(nho: boolean) {
    setThuNho(nho);
    ghiLuu(KHOA_THU_NHO, nho);
    if (nho) {
      setMoTc(false);
      setLoiChao(null);
    }
    requestAnimationFrame(() => nutRef.current?.focus());
  }

  const hinh = dang === null ? null : dang.kieu === "nhan" ? dang.cx.loai : dang.loai;
  const lv = hinh === null ? null : CAM_XUC[hinh];
  const ngu = nguDen !== null && dang === null;
  const coNut = dang !== null || !trangThai.an;
  const nho = thuNho && dang === null;
  const lop = [
    "linh-vat",
    dang?.kieu === "nhan" ? "linh-vat--mang" : "",
    dien !== null && VANG_MAT[dien] !== undefined ? `linh-vat--vang-${dien}` : "",
    nho ? "linh-vat--thu-nho" : "",
    tranh && dien === null ? "linh-vat--tranh" : "",
    dangDi ? "linh-vat--dang-di" : "",
  ].filter(Boolean).join(" ");
  const choPhepDi = !reduce && !tamDung && !hep && !thuNho && coNut;

  // Vong di chuyen: rAF sua truc tiep transform cua .linh-vat (vi tri tuyet doi + banking + tho/nhay); React chi giu
  // trang thai dangDi (lop vo canh). Tat khi reduce, tam dung, man hep, thu nho, an nut.
  // Luu y: thuNho chi co sau khi actionChaoChip tra ve, nhung lan di dau tien luon sau 1,4 giay nghi nen khong kip di
  // truoc khi biet minh dang thu nho.
  useEffect(() => {
    const goc = gocRef.current;
    if (!choPhepDi || !goc) {
      if (goc) goc.style.removeProperty("transform");
      // oxlint-disable-next-line react/set-state-in-effect -- dong bo trang thai React voi vong dong co ngoai React (rAF + DOM): tat engine thi tat vo canh.
      setDangDi(false);
      return;
    }
    if (viTriRef.current === null) viTriRef.current = diemGoc(window.innerWidth, window.innerHeight, CO_CHIP_PX, LE_CHIP_PX);
    nghiDenRef.current = performance.now() + thoiGianNghi();
    if (hopRef.current.denKe === 0) hopRef.current.denKe = performance.now() + NHAY_CHU_KY_TU_MS + Math.random() * (NHAY_CHU_KY_DEN_MS - NHAY_CHU_KY_TU_MS);
    let raf = 0;
    let cuoi = performance.now();
    const apDung = (pos: Diem, gocNha: Diem, bank: { goc: number; tiLeX: number; tiLeY: number }, nhay: number) => {
      const dx = pos.x - gocNha.x;
      const dy = pos.y - gocNha.y;
      goc.style.transform = `translate(${dx}px, ${dy + nhay}px) rotate(${bank.goc}deg) scale(${bank.tiLeX}, ${bank.tiLeY})`;
    };
    const tick = (bayGio: number) => {
      const dt = Math.min(50, bayGio - cuoi);
      cuoi = bayGio;
      const rong = window.innerWidth;
      const cao = window.innerHeight;
      const gocNha = diemGoc(rong, cao, CO_CHIP_PX, LE_CHIP_PX);
      if (viTriRef.current === null) viTriRef.current = { ...gocNha };
      let pos = viTriRef.current;
      // Resize: kep vi tri vao man hinh, ngoai thi ve goc.
      if (pos.x < LE_CHIP_PX || pos.x > rong - LE_CHIP_PX - CO_CHIP_PX || pos.y < LE_CHIP_PX || pos.y > cao - LE_CHIP_PX - CO_CHIP_PX) {
        pos = { ...gocNha };
        viTriRef.current = pos;
        cheDoRef.current = "nghi";
        duongRef.current = null;
        veNhaRef.current = false;
        setDangDi(false);
      }
      const neo = neoRef.current || document.querySelector("dialog[open]") !== null;
      if (cheDoRef.current === "di") {
        const tien = duongRef.current;
        if (tien === null) {
          cheDoRef.current = "nghi";
          veNhaRef.current = false;
        } else {
          if (neo && !veNhaRef.current) {
            // Dang di ma bi neo: doi sang duong ve nha nhanh.
            const ve = duongVeNha(pos, gocNha);
            if (ve.length === 0) {
              duongRef.current = null;
              cheDoRef.current = "nghi";
              setDangDi(false);
            } else {
              duongRef.current = { doan: ve, chiSo: 0, daDi: 0 };
              veNhaRef.current = true;
            }
          }
          const hien = duongRef.current;
          if (hien !== null) {
            let het = false;
            let conLai = dt;
            while (conLai > 0 && !het) {
              const doan = hien.doan[hien.chiSo];
              if (doan === undefined) {
                het = true;
                break;
              }
              const buoc = Math.min(conLai, doan.thoiGian - hien.daDi);
              hien.daDi += buoc;
              conLai -= buoc;
              const t = Math.min(1, hien.daDi / doan.thoiGian);
              const e = ease(t);
              const nx = bezier(doan.x0, doan.cx, doan.x1, e);
              const ny = bezier(doan.y0, doan.cy, doan.y1, e);
              const vx = ((nx - pos.x) / Math.max(1, buoc)) * 1000;
              const vy = ((ny - pos.y) / Math.max(1, buoc)) * 1000;
              pos = { x: nx, y: ny };
              viTriRef.current = pos;
              apDung(pos, gocNha, tinhBanking(vx, vy), 0);
              if (t >= 1) {
                hien.chiSo += 1;
                hien.daDi = 0;
                if (hien.chiSo >= hien.doan.length) het = true;
              }
            }
            if (het) {
              const veNha = veNhaRef.current;
              cheDoRef.current = "nghi";
              duongRef.current = null;
              veNhaRef.current = false;
              setDangDi(false);
              nghiDenRef.current = bayGio + (veNha ? 1000 : thoiGianNghi());
            }
          }
        }
      } else if (neo) {
        // Dang nghi ma bi neo: ve goc nhanh, toi goc thi dung yen (khong tho, khong nhay, khong noi).
        if (pos.x !== gocNha.x || pos.y !== gocNha.y) {
          const ve = duongVeNha(pos, gocNha);
          if (ve.length === 0) {
            viTriRef.current = { ...gocNha };
            goc.style.removeProperty("transform");
          } else {
            duongRef.current = { doan: ve, chiSo: 0, daDi: 0 };
            cheDoRef.current = "di";
            veNhaRef.current = true;
            setDangDi(true);
          }
        } else {
          goc.style.removeProperty("transform");
        }
      } else {
        // Nghi tai cho: tho nhe, nhay chan sao, het gio nghi thi bat dau di (tab dang xem moi di).
        const tho = heSoTho(bayGio);
        let nhay = 0;
        if (bayGio > hopRef.current.denKe) {
          hopRef.current = { batDau: bayGio, denKe: bayGio + NHAY_CHU_KY_TU_MS + Math.random() * (NHAY_CHU_KY_DEN_MS - NHAY_CHU_KY_TU_MS) };
        }
        const batDauNhay = hopRef.current.batDau;
        if (batDauNhay !== null) {
          const ht = (bayGio - batDauNhay) / NHAY_MS;
          if (ht >= 1) hopRef.current.batDau = null;
          else nhay = -Math.sin(ht * Math.PI) * NHAY_CAO_PX;
        }
        apDung(pos, gocNha, { goc: 0, tiLeX: tho, tiLeY: tho }, nhay);
        if (bayGio > nghiDenRef.current && document.visibilityState === "visible") {
          const cam = vungCamHienTai();
          const den = chonDiemDen(rong, cao, CO_CHIP_PX, LE_CHIP_PX, cam);
          const doan = duongDi(pos, den, rong, cao, CO_CHIP_PX, LE_CHIP_PX, Math.random, cam);
          if (doan.length === 0) {
            nghiDenRef.current = bayGio + 1500;
          } else {
            duongRef.current = { doan, chiSo: 0, daDi: 0 };
            cheDoRef.current = "di";
            veNhaRef.current = false;
            setDangDi(true);
          }
        }
      }
      // Luc dang di, vi tri doi moi khung nen xet giao nhau thuong xuyen hon khoang 1 giay luc ngoi yen.
      if (cheDoRef.current === "di" && bayGio > kiemTranhSauRef.current) {
        xetTranh();
        kiemTranhSauRef.current = bayGio + 250;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      goc.style.removeProperty("transform");
    };
  }, [choPhepDi]);
  const giu = {
    onPointerEnter: () => { giuRef.current = true; },
    onPointerLeave: () => { giuRef.current = false; },
    onFocus: () => { giuRef.current = true; },
    onBlur: () => { giuRef.current = false; },
  };
  const nutDong = (ten: string) => (
    <button
      type="button"
      className="loi-lv__dong"
      aria-label={`Đóng lời ${ten}`}
      onClick={() => {
        dongBong();
        nutRef.current?.focus();
      }}
    >
      <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" /></svg>
    </button>
  );

  return (
    <>
      <p className="sr-only" aria-live="polite">{bao}</p>
      <div className={lop} ref={gocRef}>
        {moTc && (
          <TroChuyen
            tenMinh={tenMinh}
            tenKia={tenKia}
            dang={trangThai.dang}
            nguDen={nguDen}
            coKhoa={trangThai.coKhoa}
            doiNgu={setNguDen}
            dong={() => {
              setMoTc(false);
              nutRef.current?.focus();
            }}
            thuNho={() => doiThuNho(true)}
            daTha={daTha}
          />
        )}
        {dang !== null && lv !== null && (
          // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- chi giu bong bong lai khi re chuot hay focus, khong phai mot dieu khien.
          <div className="loi-lv" {...giu}>
            <p className="loi-lv__chu">
              {dang.kieu === "nhan" ? (
                <>
                  <b>{tenKia}</b>{` ${lv.cau}`}
                  <small>{dongMangToi(lv.ten, dang.cx.luc, new Date())}</small>
                </>
              ) : (
                <>
                  {`${lv.ten} đang mang `}<b>{lv.camXuc}</b>{` tới ${tenKia}.`}
                  <small>{`${tenKia} không mở web lúc này thì lần sau vào sẽ thấy.`}</small>
                </>
              )}
            </p>
            {nutDong(lv.ten)}
          </div>
        )}
        {dang === null && loiChao !== null && (
          // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- chi giu bong bong lai khi re chuot hay focus, khong phai mot dieu khien.
          <div className="loi-lv loi-lv--chao" {...giu}>
            <div className="loi-lv__than">
              <p className="loi-lv__chu"><ChuDam cau={loiChao.cau} /></p>
              <div className="loi-lv__hang">
                {loiChao.nut !== null && <Link className="btn btn--line btn--sm" href={loiChao.nut.href}>{loiChao.nut.nhan}</Link>}
                <button
                  type="button"
                  className="btn btn--chu btn--sm"
                  onClick={() => {
                    dongBong();
                    setMoTc(true);
                  }}
                >
                  Nói chuyện với Chíp
                </button>
              </div>
            </div>
            {nutDong(CHIP.ten)}
          </div>
        )}
        {coNut && (
          <button
            ref={nutRef}
            type="button"
            className="linh-vat__nut"
            aria-label={nho ? `${CHIP.ten} đang thu nhỏ, bấm để hiện lại` : `${CHIP.ten}, mở trò chuyện`}
            aria-expanded={nho ? undefined : moTc}
            onClick={() => {
              if (nho) doiThuNho(false);
              else setMoTc((x) => !x);
            }}
          >
            <AnhLinhVat key={hinh ?? trangThai.dang} loai={hinh} dang={trangThai.dang} className="linh-vat__hinh" tinh={ngu} />
            {ngu && (
              // oxlint-disable-next-line nextjs/no-img-element -- anh tinh tu public/, da thu nho san.
              <img className="linh-vat__ngu" src="/linh-vat/ngu.webp" alt="" width={96} height={96} decoding="async" />
            )}
          </button>
        )}
      </div>
      {dien !== null && <div className="hieu-ung" ref={lopRef} aria-hidden="true" />}
    </>
  );
}
