"use client";

import Link from "next/link";
import { Fragment, useEffect, useEffectEvent, useRef, useState } from "react";
import { actionCamXucChoToi, actionDaXemCamXuc } from "@/app/actions/cam-xuc";
import { actionChaoChip } from "@/app/actions/chip";
import { msTuCss } from "@/components/reader/Flipbook";
import { CAM_XUC, CHIP, dongMangToi, type LoaiCamXuc } from "@/lib/cam-xuc";
import { tachDam } from "@/lib/chip";
import type { CamXucToi } from "@/server/cam-xuc/cam-xuc";
import type { LoiChao, TrangThaiChip } from "@/server/chip/tro-chuyen";
import { AnhLinhVat } from "./AnhLinhVat";
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
  const [loiChao, setLoiChao] = useState<LoiChao | null>(null);
  const gocRef = useRef<HTMLDivElement>(null);
  const nutRef = useRef<HTMLButtonElement>(null);
  const lopRef = useRef<HTMLDivElement>(null);
  const henRef = useRef(new Set<ReturnType<typeof setTimeout>>());
  /** Chuot dang tren bong bong hay focus dang trong no: chua tu dong, doc cho xong. */
  const giuRef = useRef(false);

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
  useEffect(() => {
    let con = true;
    void actionChaoChip().then((loi) => {
      if (con) chao(loi);
    }, () => {
      if (con) chao(null);
    });
    return () => {
      con = false;
    };
  }, []);

  // Khong de len khung YouTube khi ngoi yen: dang giao voi mot iframe hay khung phat chung thi tam an. Luc dang dien
  // hieu ung thi duoc de (ngoai le cung lop hieu ung), het hieu ung thi xet lai ngay.
  useEffect(() => {
    let khungHinh = 0;
    const xet = () => {
      khungHinh = 0;
      const goc = gocRef.current;
      if (!goc) return;
      const r = goc.getBoundingClientRect();
      setTranh([...document.querySelectorAll("iframe, aside.mph:not([hidden])")].some((el) => giao(r, el.getBoundingClientRect())));
    };
    const hen = () => {
      if (khungHinh === 0) khungHinh = requestAnimationFrame(xet);
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
  ].filter(Boolean).join(" ");
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
            <AnhLinhVat key={hinh ?? "chip"} loai={hinh} className="linh-vat__hinh" tinh={ngu} />
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
