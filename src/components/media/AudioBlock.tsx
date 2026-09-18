"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type Ref } from "react";
import { clockLabel, durationLabel } from "@/lib/media/clock";
import { PEAK_COUNT, PEAK_MAX } from "@/lib/media/kinds";
import { WAVE_HEIGHT, WAVE_STEP, waveBars } from "@/lib/media/wave";
import { IconMicTat, IconPhat, IconTamDung } from "./icons";

export type AudioBlockProps = {
  /** /m/{id} o man viet va man doc, blob: o hop nghe thu. */
  src: string;
  ms: number;
  peaks: readonly number[];
  /** Ten nguoi dang, cho nhan "{ten} ghi am". */
  author: string;
  /** Ref cua nut phat: hop nghe thu dua focus vao day sau khi dung ghi. */
  buttonRef?: Ref<HTMLButtonElement>;
  /** Nghi thuc mo chua go toi khoi nay (DocView typing): giu cho nhung an ca khoi. */
  pending?: boolean;
  /** Ve them trong khoi, vd nut Bo ghi am cua man viet. */
  children?: ReactNode;
};

const SONG_RONG = PEAK_COUNT * WAVE_STEP;

/** Doan dang phat trong the nay. Moi luc chi mot doan phat: doan khac bat dau thi doan nay tam dung. */
let dangPhat: HTMLAudioElement | null = null;

/**
 * Khoi ghi am cao co dinh --khoi-ghi-am-h: nut phat chiem tron chieu cao, nhan, gio da nghe tren tong do dai, song am
 * PEAK_COUNT cot tu attrs. Khong tu phat; preload none nen khong tai gi toi khi bam. Tien do la be rong cua rect trong
 * clipPath, khong can style. Go ra (lat trang, doi to) thi tieng dung. Tai hong thi thanh cho trong cung hinh hoc.
 */
export function AudioBlock({ src, ms, peaks, author, buttonRef, pending = false, children }: AudioBlockProps) {
  const cho = pending ? " chua-go-khoi" : "";
  const audioRef = useRef<HTMLAudioElement>(null);
  const [phat, setPhat] = useState(false);
  const [at, setAt] = useState(0);
  const [hong, setHong] = useState(false);
  const goc = useId().replace(/[^A-Za-z0-9_-]/g, "");
  const nhanId = `${goc}-nhan`;
  const daId = `${goc}-da`;

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      // Chi pause() khi that su dang phat: preload none nen goi pause() luc chua tung phat (networkState
      // NETWORK_EMPTY) lai dong bo mo dau thuat toan chon nguon, dung nguoc voi y dinh cua preload none.
      if (audio && !audio.paused) audio.pause();
      if (dangPhat === audio) dangPhat = null;
    };
  }, []);

  function batTat() {
    const audio = audioRef.current;
    if (!audio) return;
    if (!audio.paused) {
      audio.pause();
      return;
    }
    audio.play().catch(() => {
      // play() cung tu choi khi bi tam dung ngay sau khi bam; chi bao hong khi tep that su khong tai duoc.
      if (audio.error) setHong(true);
    });
  }

  if (hong) {
    return (
      <figure className={`khoi-ghi-am khoi-ghi-am--loi${cho}`}>
        <span className="khoi-ghi-am__nut khoi-ghi-am__nut--tat" aria-hidden="true">
          <span className="khoi-ghi-am__tron"><IconMicTat /></span>
        </span>
        <div className="khoi-ghi-am__than">
          <div className="khoi-ghi-am__dau">
            <span className="khoi-ghi-am__nhan">{author} ghi âm</span>
            <span className="khoi-ghi-am__gio">{durationLabel(ms)}</span>
          </div>
          <div className="khoi-ghi-am__loi">Chưa tải được ghi âm.</div>
        </div>
        {children}
      </figure>
    );
  }

  const cot = waveBars(peaks, PEAK_MAX).map((b, i) => (
    // oxlint-disable-next-line react/no-array-index-key -- so cot co dinh PEAK_COUNT, ve lai theo dung thu tu, khong chen xoa.
    <rect key={i} x={b.x} y={b.y} width={b.width} height={b.height} />
  ));

  return (
    <figure className={`khoi-ghi-am${cho}`} aria-labelledby={nhanId}>
      {/* oxlint-disable-next-line jsx-a11y/media-has-caption -- ghi am nhat ky cua hai nguoi, khong co ban chu; nhan va thoi luong doc qua nhan cua khoi. */}
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={(e) => {
          if (dangPhat && dangPhat !== e.currentTarget) dangPhat.pause();
          dangPhat = e.currentTarget;
          setPhat(true);
        }}
        onPause={(e) => {
          if (dangPhat === e.currentTarget) dangPhat = null;
          setPhat(false);
        }}
        onEnded={() => setAt(0)}
        onTimeUpdate={(e) => setAt(Math.min(ms, e.currentTarget.currentTime * 1000))}
        onError={() => setHong(true)}
      />
      <button ref={buttonRef} type="button" className="khoi-ghi-am__nut" aria-label={phat ? "Tạm dừng ghi âm" : "Phát ghi âm"} onClick={batTat}>
        <span className="khoi-ghi-am__tron">{phat ? <IconTamDung /> : <IconPhat />}</span>
      </button>
      <div className="khoi-ghi-am__than">
        <div className="khoi-ghi-am__dau">
          <span className="khoi-ghi-am__nhan" id={nhanId}>
            {author} ghi âm<span className="sr-only">, dài {durationLabel(ms)}</span>
          </span>
          <span className="khoi-ghi-am__gio" aria-hidden="true">{clockLabel(at)} / {durationLabel(ms)}</span>
        </div>
        <svg className="khoi-ghi-am__song" viewBox={`0 0 ${SONG_RONG} ${WAVE_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <defs>
            <clipPath id={daId}>
              <rect x="0" y="0" width={(SONG_RONG * at) / ms} height={WAVE_HEIGHT} />
            </clipPath>
          </defs>
          <g className="khoi-ghi-am__nen">{cot}</g>
          <g className="khoi-ghi-am__da" clipPath={`url(#${daId})`}>{cot}</g>
        </svg>
      </div>
      {children}
    </figure>
  );
}
