"use client";

import { useId, useRef, useState } from "react";
import { COVERS, TITLE_MAX, type CoverKey } from "@/lib/book";
import { parseYoutubeLink, youtubeLink, type YoutubeLink } from "@/lib/youtube";
import type { CoverValue } from "./CoverPicker";

const TEN_TRONG = "Sách cần có tên. Viết vài chữ, đổi lại sau cũng được.";
const GOI_Y = "Tên hiện trên kệ. Đổi lại được sau.";
const NHAC_GOI_Y = "Không bắt buộc. Dán link YouTube, nhạc phát khi mở bìa sách.";
const NHAC_DA_NHAN = "Nhạc phát khi mở bìa sách.";

/** Gia tri hien tai cua mot cuon, de dien san. null la cuon moi, chua co gi. */
type BookNow = { title: string; cover: CoverKey; youtubeId: string | null; coverMediaId: string | null } | null;

type MusicState = ReturnType<typeof useMusicField>;
type BookEditState = ReturnType<typeof useBookEdit>;

/** Dong duoi o nhac nen: loi sau lan roi o dau tien, chip khi link doc ra mot video, con lai la goi y. */
function MusicHelp({ id, check, touched }: { id: string; check: YoutubeLink; touched: boolean }) {
  if (!check.ok && touched) return <p className="field__help field__help--loi" id={id}>{check.error}</p>;
  if (check.ok && check.id !== null) {
    return (
      <p className="field__help field__help--co" id={id}>
        <span className="chip chip--key">
          <svg viewBox="0 0 12 12" aria-hidden="true">
            <path d="M2.5 6.3l2.3 2.2 4.7-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Đã nhận video
        </span>{" "}
        {NHAC_DA_NHAN}
      </p>
    );
  }
  return <p className="field__help" id={id}>{NHAC_GOI_Y}</p>;
}

/**
 * Trang thai cua rieng o nhac nen. Tach khoi useBookEdit vi co man chi co o nay ma khong co ten sach (trang Viet tiep,
 * mot dong cua muc Nhac theo luot): gop chung thi nhung man do phai mang theo mot o ten sach khong bao gio dung toi, va
 * phep kiem cua no se chan lan gui.
 */
export function useMusicField(youtubeId: string | null) {
  const [music, setMusic] = useState(youtubeId ? youtubeLink(youtubeId) : "");
  const [musicTouched, setMusicTouched] = useState(false);
  const musicRef = useRef<HTMLInputElement>(null);
  // Cung ham kiem voi may chu (parseYoutubeLink), nen giao dien khong bao gio nhan mot gia tri ma may chu se tu choi.
  const musicCheck = parseYoutubeLink(music);
  return {
    music, setMusic, musicTouched, setMusicTouched, musicRef, musicCheck,
    /** Kiem tai cho va dua focus toi o nhac neu sai. false la con sai, dung gui. */
    check: (): boolean => {
      setMusicTouched(true);
      if (!musicCheck.ok) {
        musicRef.current?.focus();
        return false;
      }
      return true;
    },
  };
}

/**
 * Trang thai cua bon truong doi duoc cua mot cuon: ten, tranh bia, bia tu tai len, nhac nen. Dung cho form tao sach.
 * Che do chia se hay rieng tu khong o day: chi form sach moi doi duoc (spec).
 */
export function useBookEdit(book: BookNow) {
  const [title, setTitle] = useState(book?.title ?? "");
  const [bia, setBia] = useState<CoverValue>({ cover: book?.cover ?? COVERS[0], photoId: book?.coverMediaId ?? null });
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const nhac = useMusicField(book?.youtubeId ?? null);
  return {
    title, setTitle, bia, setBia, touched, setTouched, busy, setBusy, titleRef, nhac,
    /** Kiem tai cho va dua focus toi o sai dau tien. false la con sai, dung gui. */
    check: (): boolean => {
      setTouched(true);
      if (title.trim() === "") {
        titleRef.current?.focus();
        nhac.setMusicTouched(true);
        return false;
      }
      return nhac.check();
    },
  };
}

/**
 * O ten sach. Tach rieng vi man Sua sach chi con o nay, con bang bia va o nhac chi hien o form tao (phan quyet B2).
 * O mang thuoc tinh name nhu cu, nen form van gui duoc bang FormData ma khong doi gi.
 */
export function TitleField({ state, disabled }: { state: BookEditState; disabled: boolean }) {
  const id = useId();
  // Rut cac truong ra bien cuc bo mot lan roi JSX doc bien: doc thang state.x trong JSX bi cong lint react/refs coi
  // la doc ref luc render, vi state mang ca hai ref o duoi.
  const { title, touched, setTitle, setTouched, titleRef } = state;
  const titleError = touched && title.trim() === "";
  return (
    <div className="field">
      <label className="field__label" htmlFor={`${id}-ten`}>Tên sách</label>
      <div className="field__o">
        <input
          ref={titleRef}
          className="input"
          id={`${id}-ten`}
          name="title"
          type="text"
          value={title}
          maxLength={TITLE_MAX}
          autoComplete="off"
          aria-invalid={titleError}
          aria-describedby={`${id}-ten-help`}
          disabled={disabled}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => setTouched(true)}
        />
        {titleError && <span className="field__dau dau-loi" aria-hidden="true">!</span>}
      </div>
      <p className={titleError ? "field__help field__help--loi" : "field__help"} id={`${id}-ten-help`}>
        {titleError ? TEN_TRONG : GOI_Y}
      </p>
    </div>
  );
}

/** O nhac nen. Nhan rieng trang thai nhac, nen dung duoc o ca man khong co ten sach. */
export function MusicField({ state, disabled }: { state: MusicState; disabled: boolean }) {
  const id = useId();
  // Cung ly do voi TitleField: JSX chi doc bien cuc bo, khong doc thang state.x.
  const { music, musicCheck, musicTouched, setMusic, setMusicTouched, musicRef } = state;
  const musicError = musicTouched && !musicCheck.ok;
  return (
    <div className="field">
      <label className="field__label" htmlFor={`${id}-nhac`}>Nhạc nền</label>
      <div className="field__o">
        <input
          ref={musicRef}
          className="input"
          id={`${id}-nhac`}
          name="music"
          type="url"
          inputMode="url"
          value={music}
          placeholder="https://youtu.be/..."
          autoComplete="off"
          spellCheck={false}
          aria-invalid={musicError}
          aria-describedby={`${id}-nhac-help`}
          disabled={disabled}
          onChange={(e) => setMusic(e.target.value)}
          onBlur={() => setMusicTouched(true)}
        />
        {musicError && <span className="field__dau dau-loi" aria-hidden="true">!</span>}
      </div>
      <MusicHelp id={`${id}-nhac-help`} check={musicCheck} touched={musicTouched} />
    </div>
  );
}
