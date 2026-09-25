"use client";

import { useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { flushSync } from "react-dom";
import { CHUA_LUU_NHAC } from "@/app/actions/messages";
import { actionSetMusicMuted } from "@/app/actions/music";
import { quaNuaTrongKhung } from "@/lib/viewport";
import { BiaMoSach, focusVungSach } from "@/components/reader/MoSach";
import { useYoutubePlayer, type MusicState } from "./useYoutubePlayer";

export type MusicRoomProps = {
  /** Ma video da chuan hoa (o nhac moi nhat cua cuon, book_tracks.youtube_id). */
  videoId: string;
  /** Lua chon tat nhac da luu cua nguoi xem (readMusicMuted), chi doc luc gan. */
  initialMuted: boolean;
  /** May chu tinh (congMoSach): loi vao khong co ?trang hay ?mo. Chi doc mot lan luc gan. */
  gate: boolean;
  /** Tam bia (BookCover), hien khi con cong. */
  cover: ReactNode;
  /** Dau man doc va man doc (Reader co key). Con cong thi chua gan. */
  children: ReactNode;
  /**
   * Phan duoi the nhac trong cot phai (khung Loi hoi dap). Chi gan khi da qua cong, nhu noi dung sach: con tam bia thi
   * nguoi xem chua doc to nao.
   */
  side?: ReactNode;
  /**
   * Trang Dau thoi gian cua cuon. Tieu de "Nhạc nền" cua the la mot loi vao thang (diem 15 cua chu du an). Chi DONG
   * TIEU DE la lien ket, khong phai ca the: khung YouTube nam ngay duoi va khong lop nao duoc de len no.
   */
  dauHref: string;
};

function dongTrangThai(state: MusicState, tat: boolean, conBia: boolean): string {
  if (state === "loi") return "Không phát được nhạc này.";
  if (state === "phat") return "Nhạc đang phát";
  if (tat) return "Đã tắt nhạc";
  return conBia ? "Nhạc phát khi mở sách" : "Nhạc chưa phát";
}

/** Loa: dang phat thi ve loa gach (hanh dong la tat), con lai ve loa co song. */
function IconLoa({ dangPhat }: { dangPhat: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5h3.2L11.5 6v12l-4.3-3.5H4z" />
      {dangPhat ? <path d="M15.5 10l4 4M19.5 10l-4 4" /> : <path d="M15 9.5a3.5 3.5 0 0 1 0 5M17.6 7a7 7 0 0 1 0 10" />}
    </svg>
  );
}

/**
 * Man doc cua sach co nhac. Mot cau truc DOM co dinh: luoi hai cot, cot chinh la tam bia hoac noi
 * dung sach, cot kia (.doc-luoi__phu) la the Nhac nen chua trinh phat YouTube that, roi khung hoi dap neu co. The nhac
 * khong bao gio doi cho trong DOM, vi doi cho iframe la tai lai video; chuyen tu bia sang sach va moi lan redirect doi
 * ?trang chi thay cot chinh.
 * Con cong thi noi dung sach chua gan: chua co phim mui ten, chua ghi to da xem, chua chay nghi thuc.
 * Chi phat bang script khi hon nua khung trinh phat dang nam trong khung nhin (Required Minimum Functionality).
 */
export function MusicRoom({ videoId, initialMuted, gate, cover, children, side, dauHref }: MusicRoomProps) {
  const tieuDe = useId();
  const chinhRef = useRef<HTMLDivElement>(null);
  const mayRef = useRef<HTMLDivElement>(null);
  const { state, play, pause } = useYoutubePlayer(mayRef, videoId);
  const [tat, setTat] = useState(initialMuted);
  // Cong chi doc luc gan: refresh() sau khi luu tat nhac ve lai trang voi gate moi, nhung khong duoc hien lai hay
  // go tam bia giua chung.
  const [coCong] = useState(gate);
  const [daMo, setDaMo] = useState(false);
  const [loiLuu, setLoiLuu] = useState<string | null>(null);
  const conBia = coCong && !daMo;
  const coPhu = !conBia && side !== undefined && side !== null;

  /** Hon nua khung trinh phat dang nam trong khung nhin, dieu kien de phat bang script. */
  function mayHienQuaNua(): boolean {
    const may = mayRef.current;
    return may !== null && quaNuaTrongKhung(may.getBoundingClientRect(), window.innerWidth, window.innerHeight);
  }

  function moSach() {
    // Gan sach dong bo (flushSync) truoc, ca lan ve lai cua Flipbook sau khi do che do mot hay hai trang
    // (useLayoutEffect), de vung sach da het visibility hidden luc nhan focus.
    flushSync(() => setDaMo(true));
    focusVungSach(chinhRef.current);
    // Do kich thuoc trinh phat SAU khi bo cuc da doi (tam bia da mat, sach da gan): playVideo() chi gui mot
    // postMessage, iframe nhan va thuc su phat o mot tac vu sau, luc do bo cuc phai on dinh (vd man hep, the nhac co
    // the da nam sau cuon sach vua mo). Kich hoat cua nguoi dung khong bi tieu thu boi cap nhat DOM dong bo (chi tinh
    // theo thoi gian), nen phat sau cap nhat layout van hop le. Khong du hien thi thi sach van mo ma khong phat: nut
    // canh khung video la Bat nhac.
    if (!tat && mayHienQuaNua()) play();
  }

  async function luu(muted: boolean) {
    try {
      const r = await actionSetMusicMuted(muted);
      setLoiLuu("error" in r ? r.error : null);
    } catch {
      setLoiLuu(CHUA_LUU_NHAC);
    }
  }

  function bamNut() {
    if (state === "tai") return;
    const tatDi = state === "phat";
    if (tatDi) {
      pause();
    } else {
      // Trinh phat chua hien qua nua (vd man hep, the nhac nam sau cuon sach): cuon no vao tam nhin, dong bo, roi do
      // lai. Cuon xong van chua hien qua nua (khung nhin qua thap) thi khong phat va khong luu: cu bam khong co tac dung.
      if (!mayHienQuaNua()) {
        mayRef.current?.scrollIntoView({ block: "nearest" });
        if (!mayHienQuaNua()) return;
      }
      play();
    }
    // Lua chon ap ngay tren may nay; luu hong thi van giu viec phat hay dung, chi bao nhe duoi the.
    setTat(tatDi);
    void luu(tatDi);
  }

  return (
    <div className="doc-luoi">
      <div ref={chinhRef} tabIndex={-1} className={daMo ? "doc-luoi__chinh doc-luoi__chinh--mo" : "doc-luoi__chinh"}>
        {conBia ? <BiaMoSach cover={cover} onMo={moSach} /> : children}
      </div>
      {/* Cot phai luon co mat va the nhac luon la con dau cua no: side chen SAU the nhac, nen iframe khong doi cho. */}
      <div className="doc-luoi__phu doc-luoi__phu--nhac">
        <aside className="nhac-the" aria-labelledby={tieuDe}>
          {/*
            Ten vung (aria-labelledby) chi lay chu "Nhạc nền" cua the span. Lien ket doc them no dan toi dau bang
            aria-label, bat dau bang dung chu nhin thay (label in name, WCAG 2.5.3). Khong ghep ten bang mot the span an
            dat canh: Chromium chen mot dau cach truoc the an, va ten doc ra co mot dau cach thua truoc dau phay.
          */}
          <h2 className="d nhac-the__t">
            <Link className="nhac-the__lien" href={dauHref} aria-label="Nhạc nền, xem dấu thời gian của cuốn này">
              <span id={tieuDe}>Nhạc nền</span>
            </Link>
          </h2>
          <div ref={mayRef} className="nhac-the__may" />
          <div className="nhac-the__dk">
            <p className={state === "loi" ? "nhac-the__chu nhac-the__chu--loi" : "nhac-the__chu"} aria-live="polite">
              {state === "loi" && <span className="dau-loi" aria-hidden="true">!</span>}
              {dongTrangThai(state, tat, conBia)}
            </p>
            {state !== "loi" && (
              <button type="button" className="btn btn--quiet" aria-disabled={state === "tai"} onClick={bamNut}>
                <IconLoa dangPhat={state === "phat"} />
                <span>{state === "phat" ? "Tắt nhạc" : "Bật nhạc"}</span>
              </button>
            )}
          </div>
          {loiLuu !== null && <p className="meta">{loiLuu}</p>}
        </aside>
        {coPhu && side}
      </div>
    </div>
  );
}
