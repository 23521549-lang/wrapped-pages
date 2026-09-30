"use client";

import Link from "next/link";
import {
  createContext, use, useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import { GIAM_CHUYEN_DONG, msTuCss } from "@/components/reader/Flipbook";
import { baiKeTiep, type ViTri } from "@/lib/so-nhac";
import { useMayPhatDanhSach, type TrangThaiMay } from "./useMayPhatDanhSach";

/*
 * Trinh phat chung (dot nam 5b, spec C): MOT trinh phat YouTube song trong layout goc, khong bao gio bi go khi doi trang
 * mem, nen nhac mo tu So nhac hay tu mot ngay o Dau thoi gian van phat khi sang trang khac. Trang muon khung phat lon dat
 * mot o giu cho (OPhat); khung phat dat dung len o do. Roi trang (khong con o cung chu) ma dang nghe thi khung tu thu
 * thanh cua so video nho o goc duoi ben phai (mot lan chuyen dong, chi transform). Khung khong bao gio nho hon 200px va
 * khong bao gio an khi dang phat: tat la go han trinh phat. Man doc sach goi tat() khi gan (useTatNhacChung).
 */

/** Mot bai trong hang doi; ten da thay san ("Bản nhạc trên YouTube") khi may chu khong lay duoc. */
export type BaiPhat = { youtubeId: string; ten: string; kenh: string | null };

/**
 * Hang doi phat: cac danh sach, phat tuan tu, het danh sach thi sang danh sach ke, vong lai, het ca thi dung
 * (src/lib/so-nhac.ts). chu: trang nguon ("so-2026-09", "dtg-<id cuon>"); o giu cho cung chu thi khung phat nam len o do.
 * nhan phan biet hai hang cung chu (ngay nao cua cuon). href: bam ten bai o cua so nho thi ve day.
 */
export type HangDoi = { chu: string; nhan: string; href: string; ds: readonly (readonly BaiPhat[])[] };

export type TrangThaiPhat = TrangThaiMay | "tai";

export type NhacChung = {
  hang: HangDoi | null;
  /** Bai dang nap hay dang phat; null la chua phat bai nao (chi nap san bai dau). */
  vt: ViTri | null;
  trangThai: TrangThaiPhat;
  /** Nguoi dung da bat phat hang nay: roi trang thi nhac di theo (cua so nho). Chi nap san thi roi trang la tat. */
  daPhat: boolean;
  phatTu: (hang: HangDoi, vt: ViTri) => void;
  /** Nap san bai dau (khong phat) cho khung lon cua trang, khi khong co gi dang nghe. */
  chuanBi: (hang: HangDoi) => void;
  choi: () => void;
  tam: () => void;
  /** Bai ke tiep theo hang doi; het thi dung (o khung lon) hay tat (cua so nho). */
  ke: () => void;
  tat: () => void;
};

const KHONG_LAM_GI = () => {};
const MAC_DINH: NhacChung = {
  hang: null, vt: null, trangThai: "tai", daPhat: false,
  phatTu: KHONG_LAM_GI, chuanBi: KHONG_LAM_GI, choi: KHONG_LAM_GI, tam: KHONG_LAM_GI, ke: KHONG_LAM_GI, tat: KHONG_LAM_GI,
};

const NhacChungCtx = createContext<NhacChung>(MAC_DINH);
type DangKyO = (chu: string, el: HTMLElement | null) => void;
const DangKyOCtx = createContext<DangKyO>(KHONG_LAM_GI);

export function useNhacChung(): NhacChung {
  return use(NhacChungCtx);
}

/** Man doc sach: gan la tat nhac chung (chi mo sach ra doc moi tat nhac nghe tu So nhac hay Dau thoi gian). */
export function useTatNhacChung(): void {
  const { tat } = useNhacChung();
  // Chi mot lan luc gan: tat() doi danh tinh moi lan hang doi doi.
  const tatLucGan = useEffectEvent(tat);
  useEffect(() => {
    tatLucGan();
  }, []);
}

/**
 * O giu cho khung phat lon cua mot trang. Khung phat chung dat dung len o nay khi hang doi dang co cung chu; khac chu (dang
 * nghe o trang khac) thi o hien children va nhac van o cua so nho.
 */
export function OPhat({ chu, className, children }: { chu: string; className?: string; children?: ReactNode }) {
  const dangKy = use(DangKyOCtx);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    dangKy(chu, el);
    return () => dangKy(chu, null);
  }, [chu, dangKy]);
  return <div ref={ref} className={className} data-o-phat={chu}>{children}</div>;
}

type CheDo = "an" | "lon" | "nho";
type ViTriCu = { r: DOMRect; x: number; y: number; coDinh: boolean };

function TamGiac() {
  return <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6 3.8v12.4a.6.6 0 0 0 .9.5l9.8-6.2a.6.6 0 0 0 0-1L6.9 3.3a.6.6 0 0 0-.9.5Z" fill="currentColor" /></svg>;
}
function HaiVach() {
  return <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="5" y="4" width="3.4" height="12" rx="1" fill="currentColor" /><rect x="11.6" y="4" width="3.4" height="12" rx="1" fill="currentColor" /></svg>;
}
function BaiKe() {
  return <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M4.5 4.2v11.6a.5.5 0 0 0 .8.4l8-5.8a.5.5 0 0 0 0-.8l-8-5.8a.5.5 0 0 0-.8.4Z" fill="currentColor" /><rect x="14" y="4" width="2.2" height="12" rx="1" fill="currentColor" /></svg>;
}
function DauX() {
  return <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M5 5l10 10M15 5 5 15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

/** Hai khung chu nhat (toa do khung nhin) co giao nhau voi khung nhin khong: bay tu ngoai man hinh vao thi bo. */
const trongKhungNhin = (r: DOMRect) => r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth;

/** Provider trong layout goc: giu hang doi, trinh phat va khung phat (dat len o giu cho hay thu thanh cua so nho). */
export function MayPhatChung({ children }: { children: ReactNode }) {
  const [hangDat, setHang] = useState<HangDoi | null>(null);
  const [vt, setVt] = useState<ViTri | null>(null);
  const [batDau, setBatDau] = useState(0);
  const [trangThai, setTrangThai] = useState<TrangThaiPhat>("tai");
  const [daPhat, setDaPhat] = useState(false);
  /** Tang len de tao lai trinh phat: nap san hang moi (bai dau khac), hay thu lai sau khi nap API hong. */
  const [lanTao, setLanTao] = useState(0);
  const [o, setO] = useState<{ chu: string; el: HTMLElement } | null>(null);
  const khungRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  const trenO = o !== null && hangDat !== null && o.chu === hangDat.chu;
  // Hang chi nap san (chua phat) ma khong con o cua no (roi trang): coi nhu khong co, trinh phat bi go, khong de mot
  // trinh phat an.
  const hang = hangDat !== null && !trenO && !daPhat ? null : hangDat;
  const idDau = hang?.ds.find((d) => d.length > 0)?.[0].youtubeId ?? null;
  const cheDo: CheDo = hang === null ? "an" : trenO ? "lon" : "nho";

  const tatHan = () => {
    may.ngung();
    setHang(null);
    setVt(null);
    setDaPhat(false);
  };
  /** Het hang doi: o khung lon thi dung va nap san lai tu dau; o cua so nho thi tat han. */
  const ketThuc = () => {
    if (cheDo !== "lon") {
      tatHan();
      return;
    }
    may.ngung();
    setVt(null);
    setDaPhat(false);
    setTrangThai((t) => (t === "loi" ? t : "dung"));
  };
  const napVt = (h: HangDoi, v: ViTri) => {
    setVt(v);
    may.nap(h.ds[v.ds][v.bai].youtubeId);
  };
  const sangBaiKe = () => {
    const k = hang !== null && vt !== null ? baiKeTiep(hang.ds, vt, batDau) : null;
    if (hang !== null && k !== null) napVt(hang, k);
    else ketThuc();
  };

  const may = useMayPhatDanhSach(videoRef, hang === null ? null : `may-${lanTao}`, idDau, {
    doi: (t) => {
      setTrangThai(t);
      if (t !== "phat" || hang === null) return;
      // Bam nut phat cua chinh khung YouTube khi moi nap san: hang bat dau tu bai dau.
      setDaPhat(true);
      if (vt === null) {
        const ds = Math.max(0, hang.ds.findIndex((d) => d.length > 0));
        setVt({ ds, bai: 0 });
        setBatDau(ds);
      }
    },
    ketThuc: sangBaiKe,
    hong: sangBaiKe,
  });

  const phatTu = (h: HangDoi, v: ViTri) => {
    // Chua co trinh phat thi mot trinh phat moi sap duoc tao: dang nap. Nap API hong thi tao lai de thu lan nua.
    if (hang === null || trangThai === "loi") setTrangThai("tai");
    if (trangThai === "loi") setLanTao((n) => n + 1);
    setHang(h);
    setBatDau(v.ds);
    setDaPhat(true);
    napVt(h, v);
  };
  const chuanBi = (h: HangDoi) => {
    if (hang !== null && (daPhat || (hang.chu === h.chu && hang.nhan === h.nhan))) return;
    if (hang !== null) setLanTao((n) => n + 1);
    setHang(h);
    setVt(null);
    setDaPhat(false);
    setTrangThai("tai");
  };

  // Ham on dinh cho context: goi ban moi nhat cua cac ham tren (cap nhat sau moi lan commit, truoc moi su kien).
  const moiNhat = useRef({ phatTu, chuanBi, ke: sangBaiKe, tat: tatHan });
  useLayoutEffect(() => {
    moiNhat.current = { phatTu, chuanBi, ke: sangBaiKe, tat: tatHan };
  });
  const hanhDong = useMemo(() => ({
    phatTu: (h: HangDoi, v: ViTri) => moiNhat.current.phatTu(h, v),
    chuanBi: (h: HangDoi) => moiNhat.current.chuanBi(h),
    ke: () => moiNhat.current.ke(),
    tat: () => moiNhat.current.tat(),
  }), []);
  const giaTri = useMemo((): NhacChung => ({
    hang, vt, trangThai, daPhat,
    phatTu: hanhDong.phatTu, chuanBi: hanhDong.chuanBi, ke: hanhDong.ke, tat: hanhDong.tat,
    choi: may.choi, tam: may.tam,
  }), [hang, vt, trangThai, daPhat, hanhDong, may]);

  const dangKy = useCallback<DangKyO>((chu, el) => {
    setO((cu) => (el !== null ? { chu, el } : cu?.chu === chu ? null : cu));
  }, []);

  // Dat khung len o giu cho (toa do tai lieu, nen cuon trang khong can tinh lai), hay tra ve cua so nho; roi mot lan
  // chuyen dong tu cho cu toi cho moi khi doi che do.
  const truoc = useRef<ViTriCu | null>(null);
  const cheDoTruoc = useRef<CheDo>("an");
  useLayoutEffect(() => {
    const khung = khungRef.current;
    if (!khung) return;
    const ghiLai = () => {
      truoc.current = { r: khung.getBoundingClientRect(), x: scrollX, y: scrollY, coDinh: cheDo === "nho" };
    };
    const dat = () => {
      if (cheDo === "lon" && o !== null) {
        const r = o.el.getBoundingClientRect();
        khung.style.top = `${r.top + scrollY}px`;
        khung.style.left = `${r.left + scrollX}px`;
        khung.style.width = `${r.width}px`;
        khung.style.height = `${r.height}px`;
      } else {
        khung.style.removeProperty("top");
        khung.style.removeProperty("left");
        khung.style.removeProperty("width");
        khung.style.removeProperty("height");
      }
      if (cheDo !== "an") ghiLai();
    };
    const cu = truoc.current;
    const doiCheDo = cheDoTruoc.current !== cheDo && cheDoTruoc.current !== "an" && cheDo !== "an";
    dat();
    cheDoTruoc.current = cheDo;
    if (doiCheDo && cu !== null && !(globalThis.matchMedia?.(GIAM_CHUYEN_DONG).matches ?? false) && typeof khung.animate === "function") {
      const tu = cu.coDinh ? cu.r : new DOMRect(cu.r.x + cu.x - scrollX, cu.r.y + cu.y - scrollY, cu.r.width, cu.r.height);
      const moi = khung.getBoundingClientRect();
      if (trongKhungNhin(tu) && moi.width > 0) {
        const goc = getComputedStyle(document.documentElement);
        const dur = msTuCss(goc.getPropertyValue("--dur-long"));
        khung.animate([
          { transformOrigin: "top left", transform: `translate(${tu.left - moi.left}px, ${tu.top - moi.top}px) scale(${tu.width / moi.width})` },
          { transformOrigin: "top left", transform: "none" },
        ], { duration: Number.isFinite(dur) && dur > 0 ? dur : 420, easing: goc.getPropertyValue("--ease-out").trim() || "cubic-bezier(0.16, 1, 0.3, 1)" });
      }
    }
    if (cheDo !== "lon" || o === null || typeof ResizeObserver === "undefined") return;
    const theoDoi = new ResizeObserver(dat);
    theoDoi.observe(o.el);
    theoDoi.observe(document.body);
    addEventListener("resize", dat);
    void document.fonts?.ready.then(dat);
    return () => {
      theoDoi.disconnect();
      removeEventListener("resize", dat);
    };
  }, [cheDo, o]);

  // Trang chua le duoi bang chieu cao cua so nho, de cuon toi cuoi van thay het noi dung.
  useEffect(() => {
    document.body.classList.toggle("co-mph", cheDo === "nho");
    return () => document.body.classList.remove("co-mph");
  }, [cheDo]);

  const bai = hang !== null && vt !== null ? hang.ds[vt.ds]?.[vt.bai] : undefined;
  const chay = trangThai === "phat";
  return (
    <NhacChungCtx value={giaTri}>
      <DangKyOCtx value={dangKy}>
        {children}
        <aside
          ref={khungRef}
          className={cheDo === "lon" ? "mph mph--lon" : "mph"}
          hidden={cheDo === "an"}
          aria-label={cheDo === "nho" ? "Nhạc đang phát" : "Trình phát nhạc"}
        >
          <div className="mph__may" ref={videoRef} />
          {cheDo === "nho" && hang !== null && (
            <div className="mph__thanh">
              <Link className="mph__ten" href={hang.href} title={bai === undefined ? undefined : `${bai.ten}${bai.kenh === null ? "" : `, ${bai.kenh}`}`}>
                <b>{bai?.ten ?? "Đang nạp"}</b>
                {bai?.kenh ? <span>{bai.kenh}</span> : null}
              </Link>
              <div className="mph__nut">
                <button type="button" className="mph__i" aria-label={chay ? "Tạm dừng" : "Phát"} onClick={chay ? may.tam : may.choi}>
                  {chay ? <HaiVach /> : <TamGiac />}
                </button>
                <button type="button" className="mph__i" aria-label="Bài kế tiếp" onClick={sangBaiKe}><BaiKe /></button>
                <button type="button" className="mph__i" aria-label="Tắt nhạc" onClick={tatHan}><DauX /></button>
              </div>
            </div>
          )}
        </aside>
      </DangKyOCtx>
    </NhacChungCtx>
  );
}
