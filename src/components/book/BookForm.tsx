"use client";

import { startTransition, useActionState, useEffect, useId, useState, type FormEvent } from "react";
import Link from "next/link";
import { actionCreateBook, actionUpdateBook } from "@/app/actions/library";
import type { BookMode, CoverKey } from "@/lib/book";
import { Button } from "@/components/Button";
import { BookCard } from "./BookCard";
import { MusicField, TitleField, useBookEdit } from "./BookEditFields";
import { chosenCoverMedia, CoverPicker } from "./CoverPicker";

type Ket = { error: string } | null;

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

/**
 * Form tao va sua sach, kem the xem truoc tren ke. Gui bang onSubmit + startTransition chu khong bang
 * thuoc tinh action cua form: sau moi lan form action xong (ke ca khi tra loi), React 19 goi form.reset();
 * o chu co kiem soat van giu gia tri, nhung radio co kiem soat quay ve lua chon luc mo trang (React khong
 * cap nhat defaultChecked), lech voi state. Thanh cong thi action tu chuyen trang (redirect).
 * Bang bia nam trong CoverPicker; dang cat hay dang tai bia tu tai len thi khoa nut gui.
 */
export function BookForm({ book, nickname, partnerNickname, mediaEnabled }: BookFormProps) {
  const id = useId();
  const doi = useBookEdit(book);
  const [mode, setMode] = useState<BookMode>(book?.mode ?? "chia-se");
  // Khoa nut gui toi khi hydrate xong, de bam som (hoac Enter) khong lot qua onSubmit ma gui GET goc cua form.
  const [sanSang, setSanSang] = useState(false);
  // oxlint-disable-next-line react/set-state-in-effect -- Dong bo voi he thong ngoai (hydrate cua React): can biet CLIENT da hydrate xong (khac server render lan dau) de khoa nut gui, khong the doc gia tri nay luc dang render.
  useEffect(() => setSanSang(true), []);
  const [state, dispatch, pending] = useActionState<Ket, FormData>(
    async (_prev, fd) => (book ? actionUpdateBook(book.id, fd) : actionCreateBook(fd)),
    null,
  );

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!doi.check()) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  }

  return (
    <div className="tao">
      <form className="form" onSubmit={submit} noValidate>
        <TitleField state={doi} disabled={pending} />
        {/* Bia va nhac chi co o form TAO: khi sua, hai thu do nam o hai muc dong thoi gian (phan quyet B2). */}
        {book === null && (
          <>
            <CoverPicker value={doi.bia} onChange={doi.setBia} bookId={null} mediaEnabled={mediaEnabled} disabled={pending} onBusyChange={doi.setBusy} />
            <MusicField state={doi} disabled={pending} />
          </>
        )}

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

        <div className="form__nut">
          <Button type="submit" disabled={pending || !sanSang || doi.busy} aria-busy={pending}>
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
          title={doi.title.trim() || "Chưa có tên"}
          cover={doi.bia.cover}
          coverMediaId={chosenCoverMedia(doi.bia)}
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
