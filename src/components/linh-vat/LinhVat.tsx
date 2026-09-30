"use client";

import { useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { actionCamXucChoToi, actionDaXemCamXuc, actionThaCamXuc } from "@/app/actions/cam-xuc";
import { CHUA_THA_CAM_XUC } from "@/app/actions/messages";
import { msTuCss } from "@/components/reader/Flipbook";
import { CAM_XUC, CHIP, dongMangToi, LOAI_CAM_XUC, type LoaiCamXuc } from "@/lib/cam-xuc";
import type { CamXucToi } from "@/server/cam-xuc/cam-xuc";
import { dienHieuUng, VANG_MAT } from "./hieu-ung";

/** Cac cam xuc da dien tren trinh duyet nay: moi cam xuc chi dien mot lan (spec D1). */
const KHOA_DA_DIEN = "mqce-cam-xuc-da-dien";

function daDien(id: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(KHOA_DA_DIEN) ?? "[]") as unknown[]).includes(id);
  } catch {
    return false;
  }
}

function ghiDaDien(id: string): void {
  try {
    const cu = (JSON.parse(localStorage.getItem(KHOA_DA_DIEN) ?? "[]") as unknown[]).filter((x): x is string => typeof x === "string");
    localStorage.setItem(KHOA_DA_DIEN, JSON.stringify([...cu.filter((x) => x !== id), id].slice(-24)));
  } catch {
    // Trinh duyet chan luu tru: cung lam cam xuc do dien lai mot lan o trang sau, khong sao.
  }
}

const giao = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const giamChuyenDong = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
const msToken = (ten: string, macDinh: number) => {
  const ms = msTuCss(getComputedStyle(document.documentElement).getPropertyValue(ten));
  return Number.isFinite(ms) && ms > 0 ? ms : macDinh;
};

/** Bong bong dang noi: linh vat mang cam xuc nguoi kia toi (nhan), hay vua mang cam xuc cua minh di (gui). */
type Dang = { kieu: "nhan"; cx: CamXucToi } | { kieu: "gui"; loai: LoaiCamXuc };

/** Anh linh vat: dong o che do thuong, khung dau tinh khi nguoi dung xin giam chuyen dong (khong can JS). */
function AnhLinhVat({ loai, className }: { loai: LoaiCamXuc | null; className: string }) {
  const lv = loai === null ? CHIP : CAM_XUC[loai];
  return (
    <picture className={className}>
      <source srcSet={lv.anhTinh} media="(prefers-reduced-motion: reduce)" />
      {/* oxlint-disable-next-line nextjs/no-img-element -- WebP dong tu public/, da thu nho san; next/image toi uu lai se mat chuyen dong. */}
      <img src={lv.anh} alt="" width={176} height={176} decoding="async" />
    </picture>
  );
}

/**
 * Chip va Kho cam xuc (dot nam 5d, spec C, D): ga con Chip ngoi goc duoi ben trai moi trang da dang nhap. Bam Chip mo Kho
 * cam xuc: tam cam xuc, moi cam xuc mot linh vat rieng; chon mot roi Tha thi linh vat do mang toi nguoi kia. Ben nhan,
 * Chip hoa thanh linh vat cua cam xuc, noi cau cua nguoi tha trong bong bong va dien hieu ung vai giay tren mot lop phu
 * ca man, xuyen chuot (ngoai le chu du an duyet: duoc de len khung YouTube). Hang cho doc san o may chu, hoi lai moi 15
 * giay khi tab dang duoc xem. Ngoi yen thi khong bao gio de len khung YouTube: cham mot khung phat thi tam an.
 */
export function LinhVat({ tenMinh, tenKia, hangDau }: { tenMinh: string; tenKia: string; hangDau: CamXucToi[] }) {
  const id = useId();
  const [mo, setMo] = useState(false);
  const [chon, setChon] = useState<LoaiCamXuc | null>(null);
  const [loi, setLoi] = useState("");
  const [dangGui, setDangGui] = useState(false);
  const [hang, setHang] = useState(hangDau);
  const [dang, setDang] = useState<Dang | null>(null);
  const [dien, setDien] = useState<LoaiCamXuc | null>(null);
  const [tranh, setTranh] = useState(false);
  const [bao, setBao] = useState("");
  const gocRef = useRef<HTMLDivElement>(null);
  const nutRef = useRef<HTMLButtonElement>(null);
  const khoRef = useRef<HTMLElement>(null);
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

  // --- Nhan: dien lan luot hang cho ---
  /** Bong bong tu dong sau 8 giay, tru khi nguoi dung dang re chuot hay focus trong no (thi hen lai 2 giay nua). */
  function tuDong() {
    if (giuRef.current) sau(2000, tuDong);
    else dongBong();
  }

  function dongBong() {
    for (const t of henRef.current) clearTimeout(t);
    henRef.current.clear();
    setDien(null);
    setDang(null);
  }

  const batDau = useEffectEvent(() => {
    if (dang !== null) return;
    const [cx, ...conLai] = hang;
    if (cx === undefined) return;
    setHang(conLai);
    if (daDien(cx.id)) return;
    ghiDaDien(cx.id);
    void actionDaXemCamXuc(cx.id).catch(() => {});
    const lv = CAM_XUC[cx.loai];
    // Kho dang mo thi dong; focus dang trong kho thi ve Chip, khong roi ve body.
    if (khoRef.current?.contains(document.activeElement)) nutRef.current?.focus();
    setMo(false);
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

  // Hieu ung: lop phu chi co trong DOM luc dang dien; do tam Chip lam goc xuat phat.
  useEffect(() => {
    const lop = lopRef.current;
    const nut = nutRef.current;
    if (dien === null || !lop || !nut) return;
    const r = nut.getBoundingClientRect();
    return dienHieuUng(dien, lop, { x: r.left + r.width / 2, y: r.top + r.height / 2 });
  }, [dien]);

  // Hoi lai moi 15 giay khi tab dang duoc xem va khong dang dien; tab an thi thoi, xem lai thi hoi ngay.
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

  // --- Kho cam xuc ---
  useEffect(() => {
    if (!mo) return;
    (khoRef.current?.querySelector<HTMLButtonElement>('[aria-pressed="true"]') ?? khoRef.current?.querySelector<HTMLButtonElement>(".cx"))?.focus();
    // Bam ra ngoai thi dong; Esc tu bat ky dieu khien nao trong kho thi dong va tra focus ve Chip (nghe tren chinh kho,
    // nhu hop Tha tam trang).
    const kho = khoRef.current;
    const ngoai = (e: PointerEvent) => {
      if (!gocRef.current?.contains(e.target as Node)) setMo(false);
    };
    const phim = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setMo(false);
      nutRef.current?.focus();
    };
    document.addEventListener("pointerdown", ngoai);
    kho?.addEventListener("keydown", phim);
    return () => {
      document.removeEventListener("pointerdown", ngoai);
      kho?.removeEventListener("keydown", phim);
    };
  }, [mo]);

  async function tha() {
    if (chon === null || dangGui) return;
    setDangGui(true);
    setLoi("");
    try {
      const r = await actionThaCamXuc(chon);
      if ("error" in r) {
        setLoi(r.error);
        return;
      }
      const lv = CAM_XUC[chon];
      setMo(false);
      nutRef.current?.focus();
      setDang((cu) => (cu?.kieu === "nhan" ? cu : { kieu: "gui", loai: chon }));
      setBao(`${lv.ten} đang mang ${lv.camXuc} tới ${tenKia}.`);
      sau(5000, () => setDang((cu) => (cu?.kieu === "gui" ? null : cu)));
    } catch {
      setLoi(CHUA_THA_CAM_XUC);
    } finally {
      setDangGui(false);
    }
  }

  const hinh = dang === null ? null : dang.kieu === "nhan" ? dang.cx.loai : dang.loai;
  const lv = hinh === null ? null : CAM_XUC[hinh];
  const lop = [
    "linh-vat",
    dang?.kieu === "nhan" ? "linh-vat--mang" : "",
    dien !== null && VANG_MAT[dien] !== undefined ? `linh-vat--vang-${dien}` : "",
    tranh && dien === null ? "linh-vat--tranh" : "",
  ].filter(Boolean).join(" ");

  return (
    <>
      <p className="sr-only" aria-live="polite">{bao}</p>
      <div className={lop} ref={gocRef}>
        {mo && (
          <section className="kho-cx" id={`${id}-kho`} ref={khoRef} aria-labelledby={`${id}-t`}>
            <h2 className="d kho-cx__t" id={`${id}-t`}>Kho cảm xúc</h2>
            <p className="kho-cx__phu">Mỗi cảm xúc có một bạn nhỏ mang tới {tenKia}.</p>
            <ul className="kho-cx__ds">
              {LOAI_CAM_XUC.map((loai) => (
                <li key={loai}>
                  <button
                    type="button"
                    className="cx"
                    aria-pressed={chon === loai}
                    onClick={() => {
                      setChon(loai);
                      setLoi("");
                    }}
                  >
                    {chon === loai ? (
                      <AnhLinhVat loai={loai} className="cx__hinh" />
                    ) : (
                      // oxlint-disable-next-line nextjs/no-img-element -- anh tinh tu public/ da thu nho san; next/image se bien WebP dong thanh anh qua may chu anh cua Next.
                      <img className="cx__hinh" src={CAM_XUC[loai].anhTinh} alt="" width={176} height={176} decoding="async" />
                    )}
                    <span className="cx__ten">{CAM_XUC[loai].camXuc}</span>
                  </button>
                </li>
              ))}
            </ul>
            {loi !== "" && <p className="form__loi" role="alert">{loi}</p>}
            <div className="kho-cx__chan">
              <p className="kho-cx__cau" aria-live="polite">
                {chon === null
                  ? "Chưa chọn cảm xúc nào."
                  : <>{`${CAM_XUC[chon].ten} sẽ nói với ${tenKia}: `}<b>{tenMinh}</b>{` ${CAM_XUC[chon].cau}`}</>}
              </p>
              <button type="button" className="btn" disabled={chon === null || dangGui} aria-busy={dangGui || undefined} onClick={() => void tha()}>
                Thả
              </button>
            </div>
          </section>
        )}
        {dang !== null && lv !== null && (
          // oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- chi giu bong bong lai khi re chuot hay focus, khong phai mot dieu khien.
          <div
            className="loi-lv"
            onPointerEnter={() => { giuRef.current = true; }}
            onPointerLeave={() => { giuRef.current = false; }}
            onFocus={() => { giuRef.current = true; }}
            onBlur={() => { giuRef.current = false; }}
          >
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
            <button
              type="button"
              className="loi-lv__dong"
              aria-label={`Đóng lời ${lv.ten}`}
              onClick={() => {
                dongBong();
                nutRef.current?.focus();
              }}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" /></svg>
            </button>
          </div>
        )}
        <button
          ref={nutRef}
          type="button"
          className="linh-vat__nut"
          aria-label={`${CHIP.ten}, mở Kho cảm xúc`}
          aria-expanded={mo}
          aria-controls={mo ? `${id}-kho` : undefined}
          onClick={() => setMo((x) => !x)}
        >
          <AnhLinhVat key={hinh ?? "chip"} loai={hinh} className="linh-vat__hinh" />
        </button>
      </div>
      {dien !== null && <div className="hieu-ung" ref={lopRef} aria-hidden="true" />}
    </>
  );
}
