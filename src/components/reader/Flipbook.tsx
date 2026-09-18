"use client";

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { DocJson } from "@/lib/doc/types";
import { flipPlan, lastVisible, pageLabel, viewOf, viewSheets, type FlipMode, type FlipPlan } from "@/lib/flip";
import { SHEET } from "@/lib/sheet";
import { DocView } from "@/components/doc/DocView";
import { useFitScale } from "@/components/sheet/useFitScale";

/** Mot lan chuyen khung: lat 3D theo flipPlan, hoac mo chong khi nguoi dung chon giam chuyen dong. */
type Turn = { kind: "lat"; target: number; plan: FlipPlan } | { kind: "mo"; target: number };
type Side = "trai" | "phai" | "don";

export const MAN_RONG = "(min-width: 760px)";
export const GIAM_CHUYEN_DONG = "(prefers-reduced-motion: reduce)";
const MO_CHONG_MS = 150;
const VUOT_TOI_THIEU = 40;
const PHONG_TOI_DA = 1.25;
const TOI_DAN: Keyframe[] = [{ opacity: 0 }, { opacity: 0.35, offset: 0.5 }, { opacity: 0.35 }];
const SANG_DAN: Keyframe[] = [{ opacity: 0.35 }, { opacity: 0.35, offset: 0.5 }, { opacity: 0 }];

/**
 * Doi mot gia tri thoi gian CSS (vd "420ms" hoac "0.42s") ra so mili giay. CSS minifier cua ban build
 * (kiem trong .next/static/chunks/*.css) viet lai "420ms" thanh ".42s": chi parseFloat thi ra 0.42, sai
 * ba bac do lon, nen phai xet don vi. Gia tri KHONG co don vi hop le ("ms" hoac "s") la gia tri khong
 * hop le - vd "420" (thieu don vi) tra NaN chu khong duoc doan la giay roi nhan 1000, keo
 * mot cu lat trang bay phut; noi goi (chuyenDong) da co san rao roi ve mac dinh 420 khi day la NaN.
 */
export function msTuCss(raw: string): number {
  const s = raw.trim();
  const so = parseFloat(s);
  if (!Number.isFinite(so)) return NaN;
  if (s.endsWith("ms")) return so;
  if (s.endsWith("s")) return so * 1000;
  return NaN;
}

/** Thoi luong va easing doc tu token --dur-long va --ease-out (420ms, cubic-bezier(0.16, 1, 0.3, 1)). */
function chuyenDong(): { dur: number; ease: string } {
  const goc = getComputedStyle(document.documentElement);
  const dur = msTuCss(goc.getPropertyValue("--dur-long"));
  return {
    dur: Number.isFinite(dur) && dur > 0 ? dur : 420,
    ease: goc.getPropertyValue("--ease-out").trim() || "cubic-bezier(0.16, 1, 0.3, 1)",
  };
}

/**
 * Vung chu mac dinh cua mot to. Xuat ra de noi ve rieng mot to (renderSheet) van dung dung markup nay. author la biet danh
 * nguoi viet to, cho khoi media.
 */
export function SheetText({ doc, author }: { doc: DocJson; author: string }) {
  return <div className="giay-noi-dung"><DocView doc={doc} author={author} /></div>;
}

/**
 * Mot to trong khung sach. i la chi so to tu 0, null la mat giay tron. children la lop bong khi dang lat.
 * renderSheet ve rieng phan ben trong to (xem FlipbookProps.renderSheet); tra undefined thi ve SheetText.
 */
function Sheet({ sheets, author, renderSheet, i, side, extra, children }: {
  sheets: readonly DocJson[];
  author: string;
  renderSheet?: (i: number) => ReactNode;
  i: number | null;
  side: Side;
  extra?: string;
  children?: ReactNode;
}) {
  const cls = `to-giay to-giay--${side}${extra ? ` ${extra}` : ""}`;
  if (i === null) return <div className={`${cls} to-giay--trong`} aria-hidden="true">{children}</div>;
  const rieng = renderSheet?.(i);
  return (
    <div className={cls}>
      {rieng === undefined ? <SheetText doc={sheets[i]} author={author} /> : rieng}
      <span className="to-giay__so">{i + 1}</span>
      {children}
    </div>
  );
}

export type FlipbookProps = {
  /** Ten sach, cho nhan cua vung sach. */
  title: string;
  /** Noi dung tung to theo thu tu; to chi so i mang so trang i + 1. It nhat mot to. */
  sheets: readonly DocJson[];
  /** Biet danh nguoi viet cuon sach: chu thay the cua anh va nhan cua ghi am. */
  author: string;
  /** To mo dau, tinh tu 0. */
  start: number;
  /** Goi moi khi khung dung yen, voi vi tri (tu 1) cua to xa nhat dang hien. */
  onReach?: (position: number) => void;
  /**
   * Ve rieng phan ben trong mot to thay cho vung chu mac dinh, vd to dang niem phong. Tra undefined thi to
   * do ve nhu thuong. Duoc goi cho moi mat giay dang hien, ke ca hai mat cua la dang lat.
   */
  renderSheet?: (i: number) => ReactNode;
  /** Goi moi khi khung dung yen, voi vi tri (tu 1) cua to dau va to cuoi dang hien. */
  onShow?: (first: number, last: number) => void;
};

/**
 * Sach lat duoc. Tu 760px tro len mo hai trang, hep hon mot trang. Nut 44px, phim mui ten trai phai o bat
 * cu dau tren trang, vuot ngang tren man cam ung. Moi chi so lay tu src/lib/flip.ts; o day chi ve va chay
 * chuyen dong (chi transform va opacity).
 */
export function Flipbook({ title, sheets, author, start, onReach, renderSheet, onShow }: FlipbookProps) {
  const n = sheets.length;
  const [mode, setMode] = useState<FlipMode | null>(null);
  // To dau cua khung dang hien. Giu to chu khong giu khung, nen doi che do van mo dung cho dang doc.
  const [at, setAt] = useState(start);
  const [turn, setTurn] = useState<Turn | null>(null);
  const queued = useRef<1 | -1 | 0>(0);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLElement>(null);
  const leafRef = useRef<HTMLDivElement>(null);
  const frontShade = useRef<HTMLSpanElement>(null);
  const backShade = useRef<HTMLSpanElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);

  // Truoc khi biet be rong man (luc render o may chu) tam coi la mot trang, va an khung sach di.
  const m: FlipMode = mode ?? "mot";
  const v = viewOf(m, at);
  const k = useFitScale(boxRef, (m === "doi" ? 2 : 1) * SHEET.width, PHONG_TOI_DA);
  const coTruoc = mode !== null && flipPlan(m, v, -1, n) !== null;
  const coSau = mode !== null && flipPlan(m, v, 1, n) !== null;

  function go(dir: 1 | -1) {
    if (mode === null) return;
    if (turn) {
      queued.current = dir;
      return;
    }
    const plan = flipPlan(mode, v, dir, n);
    if (!plan) return;
    // Lat trang thi tieng ghi am dung ngay luc bam, ke ca khi mo chong con giu to cu tren man trong luc chuyen.
    // Chi pause() doan dang phat: goi tren doan chua tung phat (preload none) lai dong bo mo dau thuat toan chon nguon.
    boxRef.current?.querySelectorAll("audio").forEach((audio) => {
      if (!audio.paused) audio.pause();
    });
    const target = v + dir;
    setTurn(window.matchMedia(GIAM_CHUYEN_DONG).matches ? { kind: "mo", target } : { kind: "lat", target, plan });
  }

  // Ban go moi nhat cho cac trinh nghe chi gan mot lan (phim, lat tiep lan da hen).
  const goRef = useRef(go);
  useLayoutEffect(() => {
    goRef.current = go;
  });

  // Gia tri m/n moi nhat, cho settle doc luc no THAT SU chay (co the la sau vai lan render nua, neu
  // turn van giu nguyen tham chieu) thay vi dong bang gia tri cua lan render tao ra hieu ung lat.
  // Cap nhat trong useLayoutEffect (khong deps, giong goRef ben tren) chu khong gan thang luc render,
  // vi gan ref trong than ham render la tac dung phu, pha quy tac render phai thuan cua React.
  const mnRef = useRef({ m, n });
  useLayoutEffect(() => {
    mnRef.current = { m, n };
  });

  function settle(target: number) {
    const { m: mLucDung, n: nLucDung } = mnRef.current;
    setAt(viewSheets(mLucDung, target, nLucDung).find((i): i is number => i !== null) ?? 0);
    setTurn(null);
  }

  // Mot hay hai trang theo be rong man; doi che do giua chung thi bo lan lat dang chay.
  useLayoutEffect(() => {
    const mq = window.matchMedia(MAN_RONG);
    const apply = () => {
      queued.current = 0;
      setTurn(null);
      setMode(mq.matches ? "doi" : "mot");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Chay chuyen dong cua lan chuyen khung; xong thi khung moi dung yen.
  useLayoutEffect(() => {
    if (!turn) return;
    const { dur, ease } = chuyenDong();
    const target = turn.target;
    let anims: Animation[] = [];
    if (turn.kind === "mo") {
      const lop = fadeRef.current;
      if (lop) anims = [lop.animate([{ opacity: 0 }, { opacity: 1 }], { duration: MO_CHONG_MS, easing: ease, fill: "forwards" })];
    } else {
      const la = leafRef.current;
      const truoc = frontShade.current;
      const sau = backShade.current;
      if (la && truoc && sau) {
        const opt: KeyframeAnimationOptions = { duration: dur, easing: ease, fill: "forwards" };
        // Mat dang hien luc bat dau thi toi dan, mat hien ra luc ket thuc thi sang dan.
        const batDauMatTruoc = turn.plan.fromDeg === 0;
        anims = [
          la.animate([{ transform: `rotateY(${turn.plan.fromDeg}deg)` }, { transform: `rotateY(${turn.plan.toDeg}deg)` }], opt),
          truoc.animate(batDauMatTruoc ? TOI_DAN : SANG_DAN, opt),
          sau.animate(batDauMatTruoc ? SANG_DAN : TOI_DAN, opt),
        ];
      }
    }
    if (anims.length === 0) {
      settle(target);
      return;
    }
    anims[0].onfinish = () => settle(target);
    return () => {
      anims[0].onfinish = null;
      for (const a of anims) a.cancel();
    };
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- settle la closure moi o moi lan render nen
    // KHONG duoc them vao day: lam vay se chay lai hieu ung nay (tuc lat lai) o moi lan render, khong chi
    // khi turn doi. Than settle da doc m/n qua mnRef.current tai thoi diem no THAT SU chay (xem dinh
    // nghia settle o tren) nen khong con dong bang gia tri cu du turn giu nguyen qua nhieu lan render.
  }, [turn]);

  // Bam trong luc dang lat thi lat tiep ngay khi xong.
  useEffect(() => {
    if (turn || queued.current === 0) return;
    const dir = queued.current;
    queued.current = 0;
    goRef.current(dir);
  }, [turn]);

  useEffect(() => {
    if (mode === null || turn) return;
    const last = lastVisible(mode, v, n);
    if (last >= 0) onReach?.(last + 1);
  }, [mode, v, n, turn, onReach]);

  // Bao cac to dang hien moi khi khung dung yen, de khung thu thach duoi sach theo dung to nguoi doc dang xem.
  useEffect(() => {
    if (mode === null || turn) return;
    const shown = viewSheets(mode, v, n).filter((i): i is number => i !== null);
    if (shown.length > 0) onShow?.(shown[0] + 1, shown[shown.length - 1] + 1);
  }, [mode, v, n, turn, onShow]);

  // Phim mui ten o bat cu dau tren trang, tru khi dang go chu hoac giu phim bo tro.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target;
      if (t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      goRef.current(e.key === "ArrowRight" ? 1 : -1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const layer = (view: number): ReactNode => {
    const shown = viewSheets(m, view, n);
    return m === "doi" ? (
      <>
        <Sheet sheets={sheets} author={author} renderSheet={renderSheet} i={shown[0]} side="trai" />
        <Sheet sheets={sheets} author={author} renderSheet={renderSheet} i={shown[1]} side="phai" />
      </>
    ) : (
      <Sheet sheets={sheets} author={author} renderSheet={renderSheet} i={shown[0]} side="don" />
    );
  };
  const khung = { "--so-to": m === "doi" ? 2 : 1, "--k": k, visibility: mode === null ? "hidden" : undefined } as CSSProperties;

  return (
    <section ref={boxRef} className="doc" aria-label={`${title}, sách đang mở`}>
      <div
        className="doc__khung"
        style={khung}
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- vung dieu khien tuy chinh that su (phim mui ten, vuot ngang doi qua no), can tabIndex de nhan focus; da thu role="application" va role="group" nhung rule van bao vi chi nhan the HTML native la "interactive". Bo tabIndex se pha ban phim.
        tabIndex={0}
        aria-label="Trang sách, dùng phím mũi tên trái phải để lật"
        onPointerDown={(e) => {
          // Chi cham va but; keo chuot de con boi den chu.
          if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s) return;
          const dx = e.clientX - s.x;
          const dy = e.clientY - s.y;
          if (Math.abs(dx) > VUOT_TOI_THIEU && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        }}
        onPointerCancel={() => {
          swipe.current = null;
        }}
      >
        <div className="sach">
          {turn?.kind === "lat" ? (
            <>
              <div className="sach__lop">
                {m === "doi" ? (
                  <>
                    <Sheet sheets={sheets} author={author} renderSheet={renderSheet} i={turn.plan.left} side="trai" />
                    <Sheet sheets={sheets} author={author} renderSheet={renderSheet} i={turn.plan.right} side="phai" />
                  </>
                ) : (
                  <Sheet sheets={sheets} author={author} renderSheet={renderSheet} i={turn.plan.right} side="don" />
                )}
              </div>
              <div
                ref={leafRef}
                className={m === "doi" ? "la la--phai" : "la la--don"}
                style={{ transform: `rotateY(${turn.plan.fromDeg}deg)` }}
                aria-hidden="true"
              >
                <Sheet sheets={sheets} author={author} renderSheet={renderSheet} i={turn.plan.front} side={m === "doi" ? "phai" : "don"}>
                  <span ref={frontShade} className="la__bong" />
                </Sheet>
                <Sheet sheets={sheets} author={author} renderSheet={renderSheet} i={turn.plan.back} side="trai" extra="la__sau">
                  <span ref={backShade} className="la__bong" />
                </Sheet>
              </div>
            </>
          ) : (
            <div className="sach__lop">{layer(v)}</div>
          )}
          {turn?.kind === "mo" && (
            <div ref={fadeRef} className="sach__lop sach__lop--moi" aria-hidden="true">{layer(turn.target)}</div>
          )}
        </div>
      </div>

      <div className="doc__dk">
        <button
          type="button"
          className="btn btn--quiet btn--icon"
          aria-label="Trang trước"
          aria-disabled={!coTruoc}
          onClick={() => {
            if (coTruoc) go(-1);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" />
          </svg>
        </button>
        <p className="doc__dem" aria-live="polite">{pageLabel(m, v, n)}</p>
        <button
          type="button"
          className="btn btn--quiet btn--icon"
          aria-label="Trang sau"
          aria-disabled={!coSau}
          onClick={() => {
            if (coSau) go(1);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
          </svg>
        </button>
      </div>
      <p className="meta doc__goi">Phím mũi tên trái phải, hoặc vuốt ngang trên màn cảm ứng.</p>
    </section>
  );
}
