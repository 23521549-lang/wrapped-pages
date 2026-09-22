"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode, type RefObject } from "react";
import { EditorContent } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { viewCount, viewOf, viewSheets, type FlipMode } from "@/lib/flip";
import { SHEET } from "@/lib/sheet";
import { useFitScale } from "@/components/sheet/useFitScale";

const BUOC = SHEET.height + SHEET.gap;

/** Man rong du cho hai to canh nhau khi dang chon niem phong. */
const MAN_DOI = "(min-width: 1181px)";
/** Man hep: khung niem phong xep doc, to giay nam duoi cung, chi thu theo be ngang. */
const MAN_XEP = "(max-width: 900px)";
/** Ti le lon nhat cua to khi xem ca to (khong phong to qua muc chu con de doc). */
const K_TRAN = 1.25;

function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (bao) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", bao);
      return () => mq.removeEventListener("change", bao);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Kich thuoc phan noi dung cua mot phan tu, theo doi bang ResizeObserver. Chua do duoc thi 0. */
function useBoxSize(ref: RefObject<HTMLElement | null>, on: boolean): { w: number; h: number } {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !on) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[entries.length - 1].contentRect;
      setSize((cu) => (cu.w === r.width && cu.h === r.height ? cu : { w: r.width, h: r.height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, on]);
  return size;
}

const MUI_TRUOC = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 6l-6 6 6 6" />
  </svg>
);
const MUI_SAU = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6" />
  </svg>
);

/**
 * Chong to giay phia sau, editor phia truoc, ca hai thu phong cung nhau; ban sao an de do thi khong thu phong.
 * Ba prop tuy chon cho trang tra loi; bo trong thi ve dung nhu man viet.
 *
 * lat: dang chon niem phong. Van la mot editor duy nhat va mot tai lieu duy nhat, chi doi cach nhin: vung chu
 * (cao dung mot buoc to + khe) duoc chia cot bang CSS multi-column, moi cot la mot to, nen cac to nam canh
 * nhau thay vi chong doc. Khoi dem ngat trang van do usePagedLayout dat dung nhu cu (vi tri va chieu cao
 * khong doi), cot chi cat giua khoi dem. Khung ngoai cat (overflow: clip) dung mot hoac hai to, dich ngang
 * bang transform de lat; ca khung thu phong bang transform, khong doi be rong hay co chu, nen cho ngat trang
 * giong het man doc.
 */
export function PagedSurface({ editor, sheetCount, mirrorRef, height, numbered = true, children, lat = false, firstNumber = 1 }: {
  editor: Editor | null;
  sheetCount: number;
  mirrorRef: RefObject<HTMLDivElement | null>;
  /** Chieu cao logic cua chong, px. Bo trong thi tinh tu sheetCount. */
  height?: number;
  /** Ve so to o chan moi to. Mac dinh co. */
  numbered?: boolean;
  /** Ve them sau editor, trong khung da thu phong (vi du vach Het trang cua trang tra loi). */
  children?: ReactNode;
  /** Xem tung to (mot hoac hai to canh nhau) kem nut lat, thay vi chong doc. */
  lat?: boolean;
  /** So in duoi to dau tien. Man sua luot in dung so trang trong cuon (to dau cua luot). Mac dinh 1. */
  firstNumber?: number;
}) {
  const fitRef = useRef<HTMLDivElement>(null);
  const oRef = useRef<HTMLDivElement>(null);
  const trongRef = useRef<HTMLDivElement>(null);
  const kChong = useFitScale(fitRef, SHEET.width, K_TRAN);
  const doi = useMedia(MAN_DOI);
  const xep = useMedia(MAN_XEP);
  const o = useBoxSize(oRef, lat);
  const cao = height ?? sheetCount * BUOC - SHEET.gap;

  const mode: FlipMode = doi ? "doi" : "mot";
  const soTo = doi ? 2 : 1;
  const rong = soTo * SHEET.width;
  const [view, setView] = useState(0);
  // Moi lan mo lai che do lat thi bat dau tu to dau (dieu chinh state ngay luc ve, khong qua effect).
  const [latTruoc, setLatTruoc] = useState(lat);
  if (lat !== latTruoc) {
    setLatTruoc(lat);
    setView(0);
  }
  const soKhung = viewCount(mode, sheetCount);
  const v = Math.min(view, soKhung - 1);

  let k = kChong;
  if (lat) {
    const theoNgang = o.w > 0 ? o.w / rong : 1;
    k = xep ? Math.min(1, theoNgang) : Math.min(K_TRAN, theoNgang, o.h > 0 ? o.h / SHEET.height : 1);
  }

  // Con tro go sang to dang khuat (chu tran sang to sau, hoac phim mui ten) thi lat toi to do. Chi khi
  // editor dang co focus: bam nut lat khong bi keo nguoc ve cho con tro.
  useEffect(() => {
    if (!lat || !editor) return;
    const theo = () => {
      const trong = trongRef.current;
      if (!trong || !editor.view.hasFocus()) return;
      let x: number;
      try {
        const r = editor.view.coordsAtPos(editor.state.selection.head);
        const goc = trong.getBoundingClientRect();
        x = (r.left - goc.left) / (goc.width / trong.offsetWidth);
      } catch {
        return;
      }
      if (!Number.isFinite(x)) return;
      setView(viewOf(mode, Math.max(0, Math.floor(x / SHEET.width))));
    };
    editor.on("transaction", theo);
    editor.on("focus", theo);
    return () => {
      editor.off("transaction", theo);
      editor.off("focus", theo);
    };
  }, [editor, lat, mode]);

  const hien = viewSheets(mode, v, sheetCount).filter((i): i is number => i !== null);
  const nhan = `Tờ ${hien.map((i) => i + 1).join("-")} / ${sheetCount}`;

  return (
    <div className={lat ? "viet-mat viet-mat--lat" : "viet-mat"} ref={fitRef}>
      {lat && <p className="viet-mat__dau">Đọc lại và sửa ngay trên trang</p>}
      <div className="viet-o" ref={oRef}>
        <div
          className={lat ? `viet-chong viet-chong--${mode}` : "viet-chong"}
          style={lat ? { width: rong * k, height: SHEET.height * k } : { width: SHEET.width * k, height: cao * k }}
        >
          <div
            ref={trongRef}
            className="viet-chong__trong"
            style={lat
              ? { width: rong, height: SHEET.height, transform: `scale(${k}) translateX(${-v * rong}px)` }
              : { height: cao, transform: `scale(${k})` }}
          >
            {Array.from({ length: sheetCount }, (_, i) => (
              <div key={i} className="to-giay viet-to" style={lat ? { top: 0, left: i * SHEET.width } : { top: i * BUOC }} aria-hidden="true">
                {numbered && <span className="to-giay__so">{firstNumber + i}</span>}
              </div>
            ))}
            <EditorContent editor={editor} className="viet-chu" />
            {children}
          </div>
        </div>
      </div>
      {lat && sheetCount > soTo && (
        <div className="viet-lat">
          <button
            type="button"
            className="btn btn--quiet btn--icon"
            aria-label="Tờ trước"
            aria-disabled={v === 0}
            onClick={() => {
              if (v > 0) setView(v - 1);
            }}
          >
            {MUI_TRUOC}
          </button>
          <p className="viet-lat__dem" aria-live="polite">{nhan}</p>
          <button
            type="button"
            className="btn btn--quiet btn--icon"
            aria-label="Tờ sau"
            aria-disabled={v >= soKhung - 1}
            onClick={() => {
              if (v < soKhung - 1) setView(v + 1);
            }}
          >
            {MUI_SAU}
          </button>
        </div>
      )}
      <div ref={mirrorRef} className="giay-noi-dung ban-sao" aria-hidden="true" />
    </div>
  );
}
