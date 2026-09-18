"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { actionUploadMedia } from "@/app/actions/media";
import { AudioBlock } from "@/components/media/AudioBlock";
import { IconDungGhi } from "@/components/media/icons";
import { GIAM_CHUYEN_DONG } from "@/components/reader/Flipbook";
import { clockLabel, durationLabel } from "@/lib/media/clock";
import { AUDIO_MAX_MS } from "@/lib/media/kinds";
import type { AudioAttrs } from "@/lib/media/node";
import { CANCEL_ASK_MS, MIC_ERRORS, micProblem, pickRecorderMime, recordingStatus, type MicProblem } from "@/lib/media/record";
import { UPLOAD_RETRY_MESSAGE } from "@/lib/media/messages";
import { WAVE_HEIGHT, WAVE_STEP, waveBars } from "@/lib/media/wave";
import { startRecording, type RecordingSession, type StopCause } from "./recording";

/** So cot cua thanh muc am luc dang ghi. */
const MUC_COT = 32;
/** Giong noi thuong co RMS duoi muc nay, nen cot cham dinh o day. */
const MUC_TOI_DA = 0.5;
const TRAN = clockLabel(AUDIO_MAX_MS);
/** Trinh duyet ngat ghi am giua chung (rut micro, mat quyen, cuoc goi den) ma khong giu duoc byte nao. */
const NGAT_TRANG = "Micro dừng giữa chừng nên chưa ghi được gì.";

type Ban = { blob: Blob; url: string; ms: number; peaks: number[] };

type Buoc =
  | { kind: "xin-quyen" }
  | { kind: "dang-ghi"; hoi: boolean }
  | { kind: "nghe-thu"; ban: Ban; cause: StopCause; dangTai: boolean; loi: boolean }
  | { kind: "loi-micro"; problem: MicProblem }
  | { kind: "loi-ngat" };

export type RecorderBoxProps = {
  id: string;
  bookId: string;
  /** Biet danh nguoi viet, cho nhan cua khoi nghe thu. */
  author: string;
  /** Tai len xong: noi goi chen khoi ghi am va dong hop. */
  onInsert: (attrs: AudioAttrs) => void;
  /** Huy hay Dong: noi goi dong hop va tra focus ve nut Ghi am. */
  onClose: () => void;
};

/**
 * Hop ghi am. Mo hop la xin micro va ghi ngay (startRecording). Tu dung o 3:00. Nghe thu
 * bang chinh khoi ghi am se chen. Chen thi tai len roi chen id, thoi luong va song am may chu da luu. Huy tu 5 giay thi hoi
 * lai ngay trong hop. Esc bang Huy. Giam chuyen dong thi thanh muc am dung yen, dong ho van chay. Khong phai hop thoai:
 * khong khoa focus, van go chu duoc. theHe tang moi lan ghi lai hay go hop, nen ket qua ve muon cua lan truoc bi bo.
 */
export function RecorderBox({ id, bookId, author, onInsert, onClose }: RecorderBoxProps) {
  const [buoc, setBuoc] = useState<Buoc>({ kind: "xin-quyen" });
  const [ms, setMs] = useState(0);
  const [muc, setMuc] = useState<readonly number[]>([]);
  const tieuDeId = useId();
  const hopRef = useRef<HTMLElement>(null);
  const dungRef = useRef<HTMLButtonElement>(null);
  const ghiTiepRef = useRef<HTMLButtonElement>(null);
  const phatRef = useRef<HTMLButtonElement>(null);
  const theHe = useRef(0);
  const phien = useRef<RecordingSession | null>(null);
  const ban = useRef<Ban | null>(null);

  function boBan() {
    if (ban.current) URL.revokeObjectURL(ban.current.url);
    ban.current = null;
  }

  function boPhien() {
    phien.current?.cancel();
    phien.current = null;
  }

  async function batDau() {
    boPhien();
    boBan();
    const so = ++theHe.current;
    setMs(0);
    setMuc([]);
    setBuoc({ kind: "xin-quyen" });
    const mime = typeof MediaRecorder === "undefined" ? null : pickRecorderMime((m) => MediaRecorder.isTypeSupported(m));
    let stream: MediaStream;
    try {
      if (!mime) throw new Error("trinh duyet khong ghi duoc dinh dang nao may chu nhan");
      stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } });
    } catch (err) {
      if (so === theHe.current) setBuoc({ kind: "loi-micro", problem: micProblem(err) });
      return;
    }
    if (so !== theHe.current) {
      for (const track of stream.getTracks()) track.stop();
      return;
    }
    const giam = window.matchMedia(GIAM_CHUYEN_DONG).matches;
    // startRecording co the nem (MediaRecorder, AudioContext hay recorder.start() hong): cung mot try nhu getUserMedia o
    // tren, vi khong bat thi stream vua xin duoc bi bo quen dang mo (micro song mai) va hop dung yen o "xin-quyen" khong
    // bao gi. Chinh startRecording cung tu don khi no nem, day chi la lop bao ve thu hai cho noi goi.
    try {
      phien.current = startRecording(stream, mime, {
        onTick: (da, levels) => {
          setMs(da);
          if (!giam) setMuc(levels.slice(-MUC_COT));
        },
        onDone: (ghi) => {
          phien.current = null;
          if (so !== theHe.current) return;
          const moi: Ban = { blob: ghi.blob, url: URL.createObjectURL(ghi.blob), ms: ghi.ms, peaks: ghi.peaks };
          ban.current = moi;
          setBuoc({ kind: "nghe-thu", ban: moi, cause: ghi.cause, dangTai: false, loi: false });
        },
        // Trinh duyet ngat ma khong con byte nao: khong co gi de nghe thu, nhung im lang thi hop dung yen mai.
        onLost: () => {
          phien.current = null;
          if (so !== theHe.current) return;
          setBuoc({ kind: "loi-ngat" });
        },
      });
    } catch (err) {
      for (const track of stream.getTracks()) track.stop();
      if (so === theHe.current) setBuoc({ kind: "loi-micro", problem: micProblem(err) });
      return;
    }
    setBuoc({ kind: "dang-ghi", hoi: false });
  }

  function huy() {
    if (buoc.kind === "dang-ghi" && !buoc.hoi && ms >= CANCEL_ASK_MS) {
      setBuoc({ kind: "dang-ghi", hoi: true });
      return;
    }
    boPhien();
    boBan();
    onClose();
  }

  async function chen(nghe: Extract<Buoc, { kind: "nghe-thu" }>) {
    const so = theHe.current;
    setBuoc({ ...nghe, dangTai: true, loi: false });
    const fd = new FormData();
    fd.set("kind", "ghi-am");
    fd.set("book", bookId);
    fd.set("file", nghe.ban.blob, "ghi-am");
    fd.set("ms", String(nghe.ban.ms));
    fd.set("peaks", JSON.stringify(nghe.ban.peaks));
    const r = await actionUploadMedia(fd).catch(() => null);
    if (so !== theHe.current) return;
    if (!r || "error" in r || r.ms === undefined) {
      setBuoc({ ...nghe, dangTai: false, loi: true });
      return;
    }
    boBan();
    onInsert({ id: r.id, ms: r.ms, peaks: r.peaks });
  }

  // Ban moi nhat cua batDau cho hieu ung gan hop, de hieu ung chi chay luc gan va go.
  const batDauRef = useRef(batDau);
  useEffect(() => {
    batDauRef.current = batDau;
  });

  // Mo hop la xin micro va ghi ngay. Go hop (dong, chen xong, roi man viet) thi tat micro va bo ban ghi chua chen.
  useEffect(() => {
    hopRef.current?.focus();
    void batDauRef.current();
    return () => {
      theHe.current += 1;
      phien.current?.cancel();
      phien.current = null;
      if (ban.current) URL.revokeObjectURL(ban.current.url);
    };
  }, []);

  // Focus theo buoc: dang ghi thi vao Dung, dang hoi huy thi vao Ghi tiep, nghe thu thi vao nut phat.
  useEffect(() => {
    if (buoc.kind === "dang-ghi") (buoc.hoi ? ghiTiepRef : dungRef).current?.focus();
    else if (buoc.kind === "nghe-thu" && !buoc.dangTai && !buoc.loi) phatRef.current?.focus();
  }, [buoc]);

  function trangThai(): { chu: string; dam: boolean } {
    if (buoc.kind === "dang-ghi") return { chu: recordingStatus(ms), dam: false };
    if (buoc.kind !== "nghe-thu") return { chu: "", dam: false };
    if (buoc.cause === "het-gio") return { chu: `Đã tự dừng ở ${TRAN}`, dam: true };
    if (buoc.cause === "ngat") return { chu: `Micro dừng ở ${durationLabel(buoc.ban.ms)}`, dam: true };
    return { chu: `Dài ${durationLabel(buoc.ban.ms)}`, dam: false };
  }

  function nut(): ReactNode {
    switch (buoc.kind) {
      case "xin-quyen":
      case "dang-ghi":
        return buoc.kind === "dang-ghi" && buoc.hoi ? (
          <>
            <button
              type="button"
              className="btn"
              onClick={() => {
                boPhien();
                onClose();
              }}
            >
              Bỏ đoạn này
            </button>
            <button ref={ghiTiepRef} type="button" className="btn btn--line" onClick={() => setBuoc({ kind: "dang-ghi", hoi: false })}>Ghi tiếp</button>
          </>
        ) : (
          <>
            <button ref={dungRef} type="button" className="btn" disabled={buoc.kind === "xin-quyen"} onClick={() => phien.current?.stop()}>
              <IconDungGhi />Dừng
            </button>
            <button type="button" className="btn btn--line" onClick={huy}>Hủy</button>
          </>
        );
      case "nghe-thu": {
        const nghe = buoc;
        return (
          <>
            <button type="button" className="btn" disabled={nghe.dangTai} aria-busy={nghe.dangTai} onClick={() => void chen(nghe)}>Chèn</button>
            <button type="button" className="btn btn--quiet" disabled={nghe.dangTai} onClick={() => void batDau()}>Ghi lại</button>
            <button type="button" className="btn btn--line" disabled={nghe.dangTai} onClick={huy}>Hủy</button>
          </>
        );
      }
      case "loi-micro":
      case "loi-ngat":
        return (
          <>
            <button type="button" className="btn" onClick={() => void batDau()}>Thử lại</button>
            <button type="button" className="btn btn--line" onClick={onClose}>Đóng</button>
          </>
        );
    }
  }

  const { chu, dam } = trangThai();
  const mucDu = [...Array.from({ length: MUC_COT - muc.length }, () => 0), ...muc];

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Esc bang Huy: phim noi bot tu cac nut trong hop, section khong tu nhan thao tac nao.
    <section
      ref={hopRef}
      id={id}
      className="ghi-am-hop"
      aria-labelledby={tieuDeId}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        huy();
      }}
    >
      <div className="ghi-am-hop__dau">
        <h2 className="d ghi-am-hop__t" id={tieuDeId}>{buoc.kind === "nghe-thu" ? "Nghe thử" : "Ghi âm"}</h2>
        <p className={dam ? "ghi-am-hop__trang-thai ghi-am-hop__trang-thai--dam" : "ghi-am-hop__trang-thai"} aria-live="polite">
          {buoc.kind === "dang-ghi" && <span className="cham-ghi" aria-hidden="true" />}
          {chu}
        </p>
      </div>
      {(buoc.kind === "xin-quyen" || buoc.kind === "dang-ghi") && (
        <div className="ghi-am-hop__do">
          <p className="ghi-am-hop__gio" role="timer" aria-label={`Đã ghi ${clockLabel(ms)}, tối đa ${TRAN}`}>
            {clockLabel(ms)} <span className="ghi-am-hop__tran">/ {TRAN}</span>
          </p>
          <svg className="muc-am" viewBox={`0 0 ${MUC_COT * WAVE_STEP} ${WAVE_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
            {waveBars(mucDu, MUC_TOI_DA).map((b, i) => (
              // oxlint-disable-next-line react/no-array-index-key -- so cot co dinh MUC_COT, cot thu i luon la vi tri thu i.
              <rect key={i} x={b.x} y={b.y} width={b.width} height={b.height} />
            ))}
          </svg>
        </div>
      )}
      {buoc.kind === "nghe-thu" && (
        <>
          <AudioBlock src={buoc.ban.url} ms={buoc.ban.ms} peaks={buoc.ban.peaks} author={author} buttonRef={phatRef} />
          {buoc.cause === "het-gio" && <p className="meta">Mỗi đoạn ghi âm dài tối đa 3 phút.</p>}
          {buoc.cause === "ngat" && <p className="meta">Micro dừng giữa chừng. Nghe thử đoạn đã ghi rồi chèn nếu dùng được.</p>}
          {buoc.loi && (
            <p className="field__help field__help--loi" role="alert"><span className="dau-loi" aria-hidden="true">!</span>{UPLOAD_RETRY_MESSAGE}</p>
          )}
        </>
      )}
      {buoc.kind === "loi-micro" && (
        <>
          <p className="field__help field__help--loi" role="alert"><span className="dau-loi" aria-hidden="true">!</span>{MIC_ERRORS[buoc.problem]}</p>
          {buoc.problem === "not-allowed" && <p className="meta">Cho phép micro cho trang này trong cài đặt trình duyệt rồi thử lại.</p>}
        </>
      )}
      {buoc.kind === "loi-ngat" && (
        <p className="field__help field__help--loi" role="alert"><span className="dau-loi" aria-hidden="true">!</span>{NGAT_TRANG}</p>
      )}
      <div className="ghi-am-hop__nut">{nut()}</div>
    </section>
  );
}
