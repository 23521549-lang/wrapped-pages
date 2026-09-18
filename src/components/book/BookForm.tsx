"use client";

import { startTransition, useActionState, useEffect, useId, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { actionCreateBook, actionUpdateBook } from "@/app/actions/library";
import { COVERS, TITLE_MAX, type BookMode, type CoverKey } from "@/lib/book";
import { parseYoutubeLink, youtubeLink, type YoutubeLink } from "@/lib/youtube";
import { Button } from "@/components/Button";
import { BookCard } from "./BookCard";
import { chosenCoverMedia, CoverPicker, type CoverValue } from "./CoverPicker";

type Ket = { error: string } | null;

const TEN_TRONG = "Sách cần có tên. Viết vài chữ, đổi lại sau cũng được.";
const GOI_Y = "Tên hiện trên kệ. Đổi lại được sau.";
const NHAC_GOI_Y = "Không bắt buộc. Dán link YouTube, nhạc phát khi mở bìa sách.";
const NHAC_DA_NHAN = "Nhạc phát khi mở bìa sách.";

const CHE_DO: { mode: BookMode; ten: string; moTa: (nguoiKia: string) => string }[] = [
  { mode: "chia-se", ten: "Chia sẻ", moTa: (p) => `${p} đọc được mọi trang bạn đăng.` },
  { mode: "rieng-tu", ten: "Riêng tư", moTa: (p) => `${p} không thấy gì, kể cả tên sách.` },
];

export type BookFormProps = {
  /** null: tao cuon moi; co gia tri: sua cuon nay. */
  book: { id: string; title: string; mode: BookMode; cover: CoverKey; youtubeId: string | null; coverMediaId: string | null } | null;
  nickname: string;
  partnerNickname: string;
  /** Kho media dang bat: tat thi khong tai bia moi len duoc, nhung bia anh cuon dang co van hien va van duoc giu. */
  mediaEnabled: boolean;
};

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
 * Form tao va sua sach, kem the xem truoc tren ke. Gui bang onSubmit + startTransition chu khong bang
 * thuoc tinh action cua form: sau moi lan form action xong (ke ca khi tra loi), React 19 goi form.reset();
 * o chu co kiem soat van giu gia tri, nhung radio co kiem soat quay ve lua chon luc mo trang (React khong
 * cap nhat defaultChecked), lech voi state. Thanh cong thi action tu chuyen trang (redirect).
 * Bang bia nam trong CoverPicker; dang cat hay dang tai bia tu tai len thi khoa nut gui.
 */
export function BookForm({ book, nickname, partnerNickname, mediaEnabled }: BookFormProps) {
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(book?.title ?? "");
  const [mode, setMode] = useState<BookMode>(book?.mode ?? "chia-se");
  const [bia, setBia] = useState<CoverValue>({
    cover: book?.cover ?? COVERS[0], photo: book?.coverMediaId ?? null, photoChosen: Boolean(book?.coverMediaId),
  });
  const [biaBan, setBiaBan] = useState(false);
  const [touched, setTouched] = useState(false);
  const musicRef = useRef<HTMLInputElement>(null);
  const [music, setMusic] = useState(book?.youtubeId ? youtubeLink(book.youtubeId) : "");
  const [musicTouched, setMusicTouched] = useState(false);
  // Khoa nut gui toi khi hydrate xong, de bam som (hoac Enter) khong lot qua onSubmit ma gui GET goc cua form.
  const [sanSang, setSanSang] = useState(false);
  // oxlint-disable-next-line react/set-state-in-effect -- Dong bo voi he thong ngoai (hydrate cua React): can biet CLIENT da hydrate xong (khac server render lan dau) de khoa nut gui, khong the doc gia tri nay luc dang render.
  useEffect(() => setSanSang(true), []);
  const [state, dispatch, pending] = useActionState<Ket, FormData>(
    async (_prev, fd) => (book ? actionUpdateBook(book.id, fd) : actionCreateBook(fd)),
    null,
  );

  // Chi bao loi sau lan roi o ten dau tien hoac lan bam gui dau tien.
  const titleError = touched && title.trim() === "";
  // Cung mot ham kiem voi may chu (parseBookInput), nen giao dien khong bao gio nhan mot link ma may chu tu choi.
  const musicCheck = parseYoutubeLink(music);
  const musicError = musicTouched && !musicCheck.ok;

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setTouched(true);
    setMusicTouched(true);
    if (title.trim() === "") {
      titleRef.current?.focus();
      return;
    }
    if (!musicCheck.ok) {
      musicRef.current?.focus();
      return;
    }
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  }

  return (
    <div className="tao">
      <form className="form" onSubmit={submit} noValidate>
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
              disabled={pending}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setTouched(true)}
            />
            {titleError && <span className="field__dau dau-loi" aria-hidden="true">!</span>}
          </div>
          <p className={titleError ? "field__help field__help--loi" : "field__help"} id={`${id}-ten-help`}>
            {titleError ? TEN_TRONG : GOI_Y}
          </p>
        </div>

        <fieldset className="chon">
          <legend>Ai đọc được</legend>
          <div className="chon__ds">
            {CHE_DO.map((c) => (
              <label key={c.mode} className="the-chon">
                <input
                  type="radio"
                  name="mode"
                  value={c.mode}
                  checked={mode === c.mode}
                  disabled={pending}
                  onChange={() => setMode(c.mode)}
                  aria-labelledby={`${id}-${c.mode}`}
                  aria-describedby={`${id}-${c.mode}-x`}
                />
                <span className="the-chon__t" id={`${id}-${c.mode}`}>{c.ten}</span>
                <span className="the-chon__x" id={`${id}-${c.mode}-x`}>{c.moTa(partnerNickname)}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <CoverPicker
          value={bia}
          onChange={setBia}
          bookId={book?.id ?? null}
          mediaEnabled={mediaEnabled}
          disabled={pending}
          onBusyChange={setBiaBan}
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
              disabled={pending}
              onChange={(e) => setMusic(e.target.value)}
              onBlur={() => setMusicTouched(true)}
            />
            {musicError && <span className="field__dau dau-loi" aria-hidden="true">!</span>}
          </div>
          <MusicHelp id={`${id}-nhac-help`} check={musicCheck} touched={musicTouched} />
        </div>

        <div className="form__nut">
          <Button type="submit" disabled={pending || !sanSang || biaBan} aria-busy={pending}>
            {pending ? (book ? "Đang lưu" : "Đang tạo") : book ? "Lưu" : "Tạo sách"}
          </Button>
          <Link className="btn btn--line" href={book ? `/sach/${book.id}` : "/ke-sach"}>Hủy</Link>
        </div>
        {state?.error && <p className="form__loi" role="alert">{state.error}</p>}
      </form>

      <aside className="xem-truoc" aria-label="Xem trước trên kệ">
        <p className="label">Xem trước</p>
        {/* coverMediaId lay dung cai form se gui: bia anh cu van la bia that ke ca khi kho tat, nen xem truoc hien no. */}
        <BookCard
          title={title.trim() || "Chưa có tên"}
          cover={bia.cover}
          coverMediaId={chosenCoverMedia(bia)}
          owner={nickname}
          meta={`${nickname} · ${book ? "đang sửa" : "vừa tạo"}`}
          excerpt={book ? undefined : "Chưa có trang nào."}
          pageCount={book ? undefined : 0}
          isPrivate={mode === "rieng-tu"}
        />
        <p className="meta">
          {mode === "rieng-tu"
            ? `${partnerNickname} không thấy cuốn này, kể cả tên.`
            : `${partnerNickname} sẽ thấy cuốn này trên kệ.`}
        </p>
      </aside>
    </div>
  );
}
