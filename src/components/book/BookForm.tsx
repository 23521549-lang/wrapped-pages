"use client";

import { startTransition, useActionState, useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { actionCreateBook, actionUpdateBook } from "@/app/actions/library";
import { COVERS, VIET_CUNG, type BookMode, type CoverKey } from "@/lib/book";
import type { LoaiDeNghi } from "@/lib/viet-cung";
import { Button } from "@/components/Button";
import { NgoiBut } from "@/components/viet-cung/NgoiBut";
import { BookCard } from "./BookCard";
import { CHU_O_TEN, MusicField, TitleField, useBookEdit } from "./BookEditFields";
import { CoverPicker, type CoverPhotoView } from "./CoverPicker";

type Ket = { error: string } | null;

/** Lua chon "Ai đọc được": hai che do cua cuon, hay "Viết cùng" (5c: chia se kem loi moi nguoi kia viet cung). */
type LuaChon = BookMode | typeof VIET_CUNG;

const CHE_DO: { mode: LuaChon; ten: (nguoiKia: string) => string; moTa: (nguoiKia: string, sua: boolean) => string }[] = [
  { mode: "chia-se", ten: () => "Chia sẻ", moTa: (p) => `${p} đọc được mọi trang bạn đăng.` },
  { mode: "rieng-tu", ten: () => "Riêng tư", moTa: (p) => `${p} không thấy gì, kể cả tên sách.` },
  {
    mode: VIET_CUNG,
    ten: (p) => `Viết cùng ${p}`,
    moTa: (p, sua) => (sua ? `Mời ${p} cùng viết cuốn này.` : `Hai người cùng viết. ${p} nhận lời thì sách sang kệ Hai Ngòi Bút.`),
  },
];

export type BookFormProps = {
  /** null: tao cuon moi; co gia tri: sua cuon nay. */
  book: { id: string; title: string; mode: BookMode; cover: CoverKey; youtubeId: string | null; coverMediaId: string | null } | null;
  nickname: string;
  partnerNickname: string;
  /** Kho media dang bat: tat thi khong tai bia moi len duoc, nhung moi anh da co trong kho van hien va van chon duoc. */
  mediaEnabled: boolean;
  /** Kho anh bia cua cuon, moi nhat truoc. Form tao sach luon rong: cuon chua ton tai nen chua co kho. */
  photos: readonly CoverPhotoView[];
  /**
   * Chi form sua: phan nam giua Ten sach va Ai doc duoc, cho dung thu tu cua trang Sach moi (Ten, Bia, Nhac nen, Ai doc
   * duoc). Man Sua sach dat hai dong thoi gian Bia va Nhac nen vao day; chung tu luu, khong di qua nut Luu cua form.
   */
  giua?: ReactNode;
  /** Chi form sua (5c): cuon da la sach viet cung. "Ai đọc được" thanh mot dong khoa, o ten thanh "Chủ đề". */
  vietCung?: boolean;
  /** Chi form sua (5c): loi moi hay loi xin viet cung dang cho cua cuon (de nghi xoa khong lien quan form nay). */
  deNghi?: { loai: LoaiDeNghi; cuaToi: boolean } | null;
};

/**
 * Form tao va sua sach, kem the xem truoc tren ke. Gui bang onSubmit + startTransition chu khong bang
 * thuoc tinh action cua form: sau moi lan form action xong (ke ca khi tra loi), React 19 goi form.reset();
 * o chu co kiem soat van giu gia tri, nhung radio co kiem soat quay ve lua chon luc mo trang (React khong
 * cap nhat defaultChecked), lech voi state. Thanh cong thi action tu chuyen trang (redirect).
 * Bang bia nam trong CoverPicker; dang cat hay dang tai bia tu tai len thi khoa nut gui.
 */
export function BookForm({ book, nickname, partnerNickname, mediaEnabled, photos, giua, vietCung = false, deNghi = null }: BookFormProps) {
  const id = useId();
  const doi = useBookEdit(book);
  // Loi moi cua minh dang cho: "Viết cùng" chon san (bo chon roi Luu la rut loi moi, 5c muc C5).
  const dangMoi = deNghi?.loai === "moi-viet" && deNghi.cuaToi;
  const dangXin = deNghi?.loai === "xin-viet" && !deNghi.cuaToi;
  const [mode, setMode] = useState<LuaChon>(dangMoi ? VIET_CUNG : book?.mode ?? "chia-se");
  const chonVietCung = mode === VIET_CUNG;
  const laChuDe = vietCung || chonVietCung;
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
        <TitleField state={doi} disabled={pending} chu={laChuDe ? CHU_O_TEN.chuDe : CHU_O_TEN.sach} />
        {/* Bia va nhac: form TAO hoi thang; form SUA dat hai dong thoi gian vao day (phan quyet B2, chu du an 28/09). */}
        {book !== null ? giua : (
          <>
            <CoverPicker
              value={doi.bia}
              onChange={doi.setBia}
              photos={photos}
              giuDuoc={false}
              bookId={null}
              mediaEnabled={mediaEnabled}
              disabled={pending}
              onBusyChange={doi.setBusy}
            />
            <MusicField state={doi.nhac} disabled={pending} />
          </>
        )}

        {vietCung ? (
          // Sach viet cung (5c muc F3): khong doi lai thanh sach rieng; form van gui che do chia se de Luu doi chu de.
          <fieldset className="chon">
            <legend>Ai viết, ai đọc</legend>
            <div className="khoa-chung">
              <NgoiBut />
              <p>
                <b>Viết cùng {partnerNickname}.</b> Cả hai đọc, viết, đổi chủ đề, bìa và nhạc; mỗi người sửa lượt của mình.
                Sách viết cùng không đổi lại thành sách riêng.
              </p>
            </div>
            <input type="hidden" name="mode" value="chia-se" />
          </fieldset>
        ) : (
          <fieldset className="chon">
            <legend>Ai đọc được</legend>
            <div className="chon__ds chon__ds--ba">
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
                    aria-describedby={c.mode === VIET_CUNG && book !== null ? `${id}-${c.mode}-x ${id}-ghi` : `${id}-${c.mode}-x`}
                  />
                  <span className="the-chon__t" id={`${id}-${c.mode}`}>
                    {c.mode === VIET_CUNG && <NgoiBut />}
                    {c.ten(partnerNickname)}
                  </span>
                  <span className="the-chon__x" id={`${id}-${c.mode}-x`}>{c.moTa(partnerNickname, book !== null)}</span>
                </label>
              ))}
            </div>
            {book !== null && (chonVietCung || dangXin) && (
              <p className="ghi-chung" id={`${id}-ghi`}>
                {dangMoi ? (
                  <><b>Đã mời {partnerNickname}.</b> Chờ {partnerNickname} nhận lời; muốn rút lời mời thì chọn lại Chia sẻ rồi Lưu.</>
                ) : dangXin ? (
                  <><b>{partnerNickname} đang xin viết cùng cuốn này.</b> Chọn Viết cùng rồi Lưu là đồng ý, hay trả lời ở Kệ sách.</>
                ) : (
                  <>
                    Bấm Lưu là gửi lời mời. <b>{partnerNickname} nhận lời</b> thì cuốn sang kệ Hai Ngòi Bút; các lượt đã đăng tự mang
                    tên &ldquo;Lượt 1&rdquo;, &ldquo;Lượt 2&rdquo;... (đổi lại được), trang niêm phong cũ giữ nguyên. Sách viết cùng không rời
                    được, chỉ xóa khi cả hai đồng ý.
                  </>
                )}
              </p>
            )}
          </fieldset>
        )}

        <div className="form__nut">
          <Button type="submit" disabled={pending || !sanSang || doi.busy} aria-busy={pending}>
            {pending ? (book ? "Đang lưu" : "Đang tạo") : book ? "Lưu" : chonVietCung ? `Tạo và mời ${partnerNickname}` : "Tạo sách"}
          </Button>
          <Link className="btn btn--line" href={book ? `/sach/${book.id}` : "/ke-sach"}>Hủy</Link>
        </div>
        {state?.error && <p className="form__loi" role="alert">{state.error}</p>}
      </form>

      <aside className="xem-truoc" aria-label="Xem trước trên kệ">
        <p className="label">Xem trước</p>
        {/* Form tao: bia form se gui. Form sua: bia hien hanh tu may chu, doi theo ngay khi mot o bia vua luu (refresh). */}
        <BookCard
          title={doi.title.trim() || "Chưa có tên"}
          cover={book ? book.cover : doi.bia.cover ?? COVERS[0]}
          coverMediaId={book ? book.coverMediaId : doi.bia.photoId}
          owner={nickname}
          meta={`${laChuDe ? `${nickname} và ${partnerNickname}` : nickname} · ${book ? "đang sửa" : "vừa tạo"}`}
          excerpt={book ? undefined : "Chưa có trang nào."}
          pageCount={book ? undefined : 0}
          isPrivate={mode === "rieng-tu"}
        />
        <p className="meta">
          {vietCung
            ? "Cuốn nằm ở kệ Hai Ngòi Bút của cả hai."
            : chonVietCung
              ? `${partnerNickname} sẽ thấy lời mời ở Kệ sách. Trước khi ${partnerNickname} nhận lời, cuốn nằm ở kệ của bạn như sách chia sẻ.`
              : mode === "rieng-tu"
                ? `${partnerNickname} không thấy cuốn này, kể cả tên.`
                : `${partnerNickname} sẽ thấy cuốn này trên kệ.`}
        </p>
      </aside>
    </div>
  );
}
