"use client";

import { startTransition, useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { actionSetDraftTrim } from "@/app/actions/library";
import { Button } from "@/components/Button";
import { COVERS, type CoverKey, type TrimInput } from "@/lib/book";
import { BookCard } from "./BookCard";
import { MusicField, useMusicField } from "./BookEditFields";
import { CoverPicker, type CoverPhotoView, type CoverValue } from "./CoverPicker";

type Ket = { error: string } | null;

const GIU_BIA = "Cuốn giữ bìa đang dùng.";
const BIA_MOI = "Bìa này bắt đầu từ lượt bạn sắp đăng.";

export type TrimFormProps = {
  bookId: string;
  title: string;
  nickname: string;
  /** Bia hien hanh cua cuon, de ve o xem truoc khi nguoi viet chon giu nguyen bia. */
  bia: { cover: CoverKey; coverMediaId: string | null };
  isPrivate: boolean;
  /** Kho anh bia cua cuon, moi nhat truoc. */
  photos: readonly CoverPhotoView[];
  /** Cuon dang co nhac nen: chi khi do moi co gi de go. */
  coNhac: boolean;
  /** Hai o ma ban nhap dang giu. Chua chon gi thi bon gia tri deu trong. */
  trim: TrimInput;
  mediaEnabled: boolean;
};

/**
 * Bieu mau cua trang Viet tiep: chon bia va nhac cho LUOT SAP DANG, roi mo man viet. Khong co o ten sach va khong co
 * muc Ai doc duoc: hai thu do la thuoc tinh cua ca cuon, doi chung van o trang Sua sach.
 * Gui bang onSubmit + startTransition chu khong bang thuoc tinh action cua form: sau moi lan form action xong (ke ca
 * khi tra loi), React 19 goi form.reset(); o chu co kiem soat van giu gia tri, nhung radio co kiem soat quay ve lua
 * chon luc mo trang (React khong cap nhat defaultChecked), lech voi state.
 */
export function TrimForm({ bookId, title, nickname, bia, isPrivate, photos, coNhac, trim, mediaEnabled }: TrimFormProps) {
  const [chon, setChon] = useState<CoverValue>({ cover: trim.cover, photoId: trim.coverMediaId });
  const [go, setGo] = useState(trim.dropTrack);
  const [busy, setBusy] = useState(false);
  const nhac = useMusicField(trim.youtubeId);
  // Khoa nut gui toi khi hydrate xong, de bam som (hoac Enter) khong lot qua onSubmit ma gui GET goc cua form.
  const [sanSang, setSanSang] = useState(false);
  const nutRef = useRef<HTMLButtonElement>(null);
  // Dua focus ve nut chinh ngay khi mo trang: ca trang nay sinh ra cho dung mot viec, nen nguoi chi muon viet tiep bam
  // Enter la di thang. Phai lam o day chu khong bang thuoc tinh autoFocus: nut con khoa cho toi khi hydrate xong, ma
  // autoFocus chi co tac dung luc gan vao cay, luc do nut van dang disabled nen trinh duyet bo qua.
  // oxlint-disable-next-line react/set-state-in-effect -- Dong bo voi he thong ngoai (hydrate cua React): can biet CLIENT da hydrate xong (khac server render lan dau) de khoa nut gui, khong the doc gia tri nay luc dang render.
  useEffect(() => setSanSang(true), []);
  useEffect(() => {
    // Chi dua duoc focus SAU khi nut het khoa: trinh duyet khong cho focus vao mot nut dang disabled.
    if (sanSang) nutRef.current?.focus();
  }, [sanSang]);
  const [state, dispatch, pending] = useActionState<Ket, FormData>(async (_prev, fd) => actionSetDraftTrim(bookId, fd), null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!go && !nhac.check()) return;
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  }

  // O xem truoc: bia dang chon, hoac bia hien hanh cua cuon khi nguoi viet giu nguyen.
  const giuNguyen = chon.cover === null;
  const veCover = giuNguyen ? bia.cover : chon.cover;
  const veAnh = giuNguyen ? bia.coverMediaId : chon.photoId;

  return (
    <div className="tao">
      <form className="form" onSubmit={submit} noValidate>
        <CoverPicker
          value={chon}
          onChange={setChon}
          photos={photos}
          giuDuoc
          bookId={bookId}
          mediaEnabled={mediaEnabled}
          disabled={pending}
          onBusyChange={setBusy}
        />
        <MusicField state={nhac} disabled={pending || go} />
        {coNhac && (
          <label className="danh-dau">
            <input
              type="checkbox"
              name="dropTrack"
              value="1"
              checked={go}
              disabled={pending}
              onChange={(e) => {
                setGo(e.target.checked);
                // Go nhac va dan mot ban nhac moi la hai y khac nhau; may chu tu choi khi co ca hai, nen o nhap duoc
                // xoa trang ngay de nguoi viet khong gui di mot thu se bi tra lai.
                if (e.target.checked) nhac.setMusic("");
              }}
            />
            <span>Gỡ nhạc nền cho lượt này</span>
          </label>
        )}

        <div className="form__nut">
          <Button ref={nutRef} type="submit" disabled={pending || !sanSang || busy} aria-busy={pending}>
            {pending ? "Đang mở" : "Viết trang"}
          </Button>
          <Link className="btn btn--line" href={`/sach/${bookId}`}>Thôi</Link>
        </div>
        {state?.error && <p className="form__loi" role="alert">{state.error}</p>}
      </form>

      <aside className="xem-truoc" aria-label="Xem trước trên kệ">
        <p className="label">Xem trước</p>
        <BookCard
          title={title}
          cover={veCover ?? COVERS[0]}
          coverMediaId={veAnh}
          owner={nickname}
          meta={`${nickname}, sắp đăng`}
          isPrivate={isPrivate}
        />
        <p className="meta">{giuNguyen ? GIU_BIA : BIA_MOI}</p>
      </aside>
    </div>
  );
}
