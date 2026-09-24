"use client";

import { useId, useRef, useState } from "react";
import { COVERS, TITLE_MAX, type CoverKey } from "@/lib/book";
import { parseYoutubeLink, youtubeLink, type YoutubeLink } from "@/lib/youtube";
import { CoverPicker, type CoverValue } from "./CoverPicker";

const TEN_TRONG = "Sách cần có tên. Viết vài chữ, đổi lại sau cũng được.";
const GOI_Y = "Tên hiện trên kệ. Đổi lại được sau.";
const NHAC_GOI_Y = "Không bắt buộc. Dán link YouTube, nhạc phát khi mở bìa sách.";
const NHAC_DA_NHAN = "Nhạc phát khi mở bìa sách.";

/** Gia tri hien tai cua mot cuon, de dien san. null la cuon moi, chua co gi. */
type BookNow = { title: string; cover: CoverKey; youtubeId: string | null; coverMediaId: string | null } | null;

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
 * Trang thai cua bon truong doi duoc cua mot cuon: ten, tranh bia, bia tu tai len, nhac nen. Dung cho form tao va sua
 * sach. Che do chia se hay rieng tu khong o day: chi form sach moi doi duoc (spec).
 */
export function useBookEdit(book: BookNow) {
  const [title, setTitle] = useState(book?.title ?? "");
  const [bia, setBia] = useState<CoverValue>({
    cover: book?.cover ?? COVERS[0], photo: book?.coverMediaId ?? null, photoChosen: Boolean(book?.coverMediaId),
  });
  const [music, setMusic] = useState(book?.youtubeId ? youtubeLink(book.youtubeId) : "");
  const [touched, setTouched] = useState(false);
  const [musicTouched, setMusicTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const musicRef = useRef<HTMLInputElement>(null);
  // Cung ham kiem voi may chu (parseBookInput), nen giao dien khong bao gio nhan mot gia tri ma may chu se tu choi.
  const musicCheck = parseYoutubeLink(music);
  return {
    title, setTitle, bia, setBia, music, setMusic, touched, setTouched, musicTouched, setMusicTouched, busy, setBusy,
    titleRef, musicRef, musicCheck,
    /** Kiem tai cho va dua focus toi o sai dau tien. false la con sai, dung gui. */
    check: (): boolean => {
      setTouched(true);
      setMusicTouched(true);
      if (title.trim() === "") {
        titleRef.current?.focus();
        return false;
      }
      if (!musicCheck.ok) {
        musicRef.current?.focus();
        return false;
      }
      return true;
    },
  };
}

/**
 * Ba o quen thuoc cua mot cuon: ten sach, bang bia (ke ca bia tu tai len), nhac nen. Cac o mang thuoc tinh name nhu cu,
 * nen form sach van gui duoc bang FormData ma khong doi gi.
 */
export function BookEditFields({ state, bookId, mediaEnabled, disabled }: {
  state: BookEditState;
  /** Cuon dang sua; null la sach moi, bia cho gan toi khi tao sach. */
  bookId: string | null;
  mediaEnabled: boolean;
  disabled: boolean;
}) {
  const id = useId();
  // Rut cac truong ra bien cuc bo mot lan roi JSX doc bien: doc thang state.x trong JSX bi cong lint react/refs coi
  // la doc ref luc render, vi state mang ca hai ref o duoi.
  const { title, bia, music, musicCheck, touched, musicTouched, setTitle, setBia, setMusic, setTouched, setMusicTouched, setBusy, titleRef, musicRef } = state;
  const titleError = touched && title.trim() === "";
  const musicError = musicTouched && !musicCheck.ok;
  return (
    <>
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

      <CoverPicker
        value={bia}
        onChange={setBia}
        bookId={bookId}
        mediaEnabled={mediaEnabled}
        disabled={disabled}
        onBusyChange={setBusy}
      />

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
    </>
  );
}
