"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { actionRemoveCoverEntry, actionSetCoverEntry } from "@/app/actions/library";
import { Button } from "@/components/Button";
import { COVERS, COVER_NAME } from "@/lib/book";
import { pageRange } from "@/lib/seal/reader";
import { dateLabel } from "@/lib/when";
import type { CoverSlot } from "@/server/library/timeline";
import { CoverArt } from "./CoverArt";
import { CoverImage } from "./CoverImage";
import { CoverPicker, type CoverPhotoView, type CoverValue } from "./CoverPicker";

export type CoverTimelineProps = {
  bookId: string;
  /** Ca dong thoi gian, gom ca o trong cua luot chua chon bia. */
  slots: readonly CoverSlot[];
  /** Kho anh bia cua cuon, moi nhat truoc. */
  photos: readonly CoverPhotoView[];
  mediaEnabled: boolean;
  now: Date;
};

/**
 * Mo mot dong ra thi keo chinh dong do vao tam nhin dung MOT lan, va chi khi no chua nam tron trong khung
 * ("nearest": da thay tron thi khong cuon di dau). Khoang chua o dinh vung cuon goc (html scroll-padding-top) lo cho
 * dong khong bao gio nam duoi thanh dieu huong dinh.
 */
function useKeoVaoTamNhin(mo: boolean) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (mo) ref.current?.scrollIntoView({ block: "nearest" });
  }, [mo]);
  return ref;
}

/** Chu cua mot o: "Lúc tạo sách" hay "Lượt 3, trang 12 tới 17, 20.09". Noi bang dau phay, khong dung dau cham giua. */
function nhanO(s: CoverSlot, now: Date): string {
  if (s.roundId === null) return "Lúc tạo sách";
  return `Lượt ${s.ordinal}, ${pageRange(s.first ?? 0, s.last ?? 0)}, ${dateLabel(s.at, now)}`;
}

/** Mot dong cua danh sach: hinh bia nho, chu, va cac nut. Mo bang chon bia thi khung mo ra ngay trong chinh dong nay. */
function Dong({ s, bookId, photos, mediaEnabled, now, boDuoc }: {
  s: CoverSlot; bookId: string; photos: readonly CoverPhotoView[]; mediaEnabled: boolean; now: Date; boDuoc: boolean;
}) {
  const [mo, setMo] = useState(false);
  const daLuu = (): CoverValue => ({ cover: s.o?.cover ?? COVERS[0], photoId: s.o?.coverMediaId ?? null });
  const [chon, setChon] = useState<CoverValue>(daLuu);
  const [busy, setBusy] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangLuu, chayLuu] = useTransition();
  const [dangBo, chayBo] = useTransition();
  const dongRef = useKeoVaoTamNhin(mo);
  const ten = nhanO(s, now);
  const dang = dangLuu || dangBo;

  /** Xong mot lan ghi: may chu tu choi thi giu khung mo va bao ngay trong dong nay; luu duoc thi dong khung lai. */
  function xong(r: { error: string } | undefined, dongKhung: boolean) {
    setLoi(r ? r.error : null);
    if (!r && dongKhung) setMo(false);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    chayLuu(async () => xong(await actionSetCoverEntry(bookId, s.roundId, fd), true));
  }

  return (
    <li className="o" ref={dongRef}>
      <span className={s.o === null ? "o__hinh o__hinh--trong" : `o__hinh bia--${s.o.cover}`} aria-hidden="true">
        {s.o !== null && (
          <>
            <CoverArt cover={s.o.cover} />
            <CoverImage mediaId={s.o.coverMediaId} />
          </>
        )}
      </span>
      <p className="o__chu">
        {ten}
        <span className="o__phu">{s.o === null ? "Chưa có bìa" : s.o.coverMediaId !== null ? "Ảnh của bạn" : COVER_NAME[s.o.cover]}</span>
      </p>
      <div className="o__nut">
        <button type="button" className="btn btn--line" disabled={dang} onClick={() => setMo((v) => !v)} aria-expanded={mo}>
          {s.o === null ? "Thêm bìa" : "Đổi bìa này"}
          <span className="sr-only"> cho {ten.toLowerCase()}</span>
        </button>
        {boDuoc && s.o !== null && (
          <button type="button" className="btn btn--line" disabled={dang} onClick={() => chayBo(async () => xong(await actionRemoveCoverEntry(bookId, s.roundId), false))}>
            Bỏ ô này
            <span className="sr-only"> của {ten.toLowerCase()}</span>
          </button>
        )}
      </div>
      {mo && (
        <div className="o__mo">
          <form className="form" onSubmit={submit} noValidate>
            <CoverPicker
              value={chon}
              onChange={setChon}
              photos={photos}
              giuDuoc={false}
              bookId={bookId}
              mediaEnabled={mediaEnabled}
              disabled={dangLuu}
              onBusyChange={setBusy}
            />
            <div className="form__nut">
              <Button type="submit" disabled={dangLuu || busy} aria-busy={dangLuu}>{dangLuu ? "Đang lưu" : "Lưu"}</Button>
              {/* Huy phai tra o ve dung gia tri dang luu: khong thi lan mo sau se hien lai lua chon dang do cua lan truoc. */}
              <button type="button" className="btn btn--line" disabled={dangLuu} onClick={() => { setChon(daLuu()); setLoi(null); setMo(false); }}>Hủy</button>
            </div>
          </form>
        </div>
      )}
      {loi !== null && <p className="o__loi" role="alert">{loi}</p>}
    </li>
  );
}

/**
 * Muc "Bia theo luot" cua man Sua sach: moi o cua dong thoi gian mot dong, ke ca o TRONG cua luot chua chon bia. Moi o
 * la mot lan gui rieng, mot giao dich rieng: nguoi dung sua tung o mot va mot o hong khong duoc keo theo o khac.
 * Cuon chi con mot o bia thi dong do khong co nut bo: moi cuon luon phai con it nhat mot o bia. May chu van la noi
 * quyet (tra "last-cover"), day chi la lop bao truoc.
 */
export function CoverTimeline({ bookId, slots, photos, mediaEnabled, now }: CoverTimelineProps) {
  const daCo = slots.filter((s) => s.o !== null).length;
  return (
    <section className="muc o-muc" aria-labelledby="bia-theo-luot">
      <h2 className="muc__t d" id="bia-theo-luot">Bìa theo lượt</h2>
      <p className="muc__x">Mỗi lượt đăng giữ được một bìa riêng. Bìa mới nhất là bìa cuốn đang dùng.</p>
      <ol className="o-ds">
        {slots.map((s) => (
          <Dong
            key={s.roundId ?? "mo-dau"}
            s={s}
            bookId={bookId}
            photos={photos}
            mediaEnabled={mediaEnabled}
            now={now}
            boDuoc={daCo > 1}
          />
        ))}
      </ol>
    </section>
  );
}
