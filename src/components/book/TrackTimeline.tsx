"use client";

import { useEffect, useRef, useState, useTransition, type FormEvent } from "react";
import { actionRemoveTrackEntry, actionSetTrackEntry } from "@/app/actions/library";
import { Button } from "@/components/Button";
import { NotNhac } from "@/components/glyph";
import { pageRange } from "@/lib/seal/reader";
import { youtubeLink } from "@/lib/youtube";
import { dateLabel } from "@/lib/when";
import type { TrackSlot } from "@/server/library/timeline";
import { MusicField, useMusicField } from "./BookEditFields";

export type TrackTimelineProps = {
  bookId: string;
  /** Ca dong thoi gian nhac, gom ca o trong cua luot chua dung toi nhac. */
  slots: readonly TrackSlot[];
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

/** Chu cua mot o: "Lúc tạo sách" hay "Lượt 3, trang 12 tới 17, 20.09". Noi bang dau phay. */
function nhanO(s: TrackSlot, now: Date): string {
  if (s.roundId === null) return "Lúc tạo sách";
  return `Lượt ${s.ordinal}, ${pageRange(s.first ?? 0, s.last ?? 0)}, ${dateLabel(s.at, now)}`;
}

/** Mot dong cua danh sach nhac. Mo ra thi o nhap link hien ngay trong chinh dong nay. */
function Dong({ s, bookId, now }: { s: TrackSlot; bookId: string; now: Date }) {
  const [mo, setMo] = useState(false);
  const [loi, setLoi] = useState<string | null>(null);
  const [dangLuu, chayLuu] = useTransition();
  const [dangBo, chayBo] = useTransition();
  const nhac = useMusicField(s.o?.youtubeId ?? null);
  const dongRef = useKeoVaoTamNhin(mo);
  const ten = nhanO(s, now);
  const dang = dangLuu || dangBo;
  const goNhac = s.o !== null && s.o.youtubeId === null;

  /** Xong mot lan ghi: may chu tu choi thi giu khung mo va bao ngay trong dong nay; luu duoc thi dong khung lai. */
  function xong(r: { error: string } | undefined, dongKhung: boolean) {
    setLoi(r ? r.error : null);
    if (!r && dongKhung) setMo(false);
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!nhac.check()) return;
    const fd = new FormData(e.currentTarget);
    chayLuu(async () => xong(await actionSetTrackEntry(bookId, s.roundId, fd), true));
  }

  /** Dat o nay thanh o GO NHAC: tu luot nay cuon khong con nhac nen. Gui thang, khong qua o nhap. */
  function go() {
    const fd = new FormData();
    fd.set("dropTrack", "1");
    chayLuu(async () => xong(await actionSetTrackEntry(bookId, s.roundId, fd), true));
  }

  return (
    <li className="moc" ref={dongRef}>
      <span className="moc__hinh moc__hinh--nhac" aria-hidden="true">
        {s.o !== null && <NotNhac go={goNhac} />}
      </span>
      <p className="moc__chu">
        {ten}
        <span className="moc__phu">
          {s.o === null ? "Chưa dùng tới nhạc" : s.o.youtubeId === null ? "Gỡ nhạc nền" : youtubeLink(s.o.youtubeId)}
        </span>
      </p>
      <div className="moc__nut">
        <button type="button" className="btn btn--line" disabled={dang} onClick={() => setMo((v) => !v)} aria-expanded={mo}>
          {s.o === null ? "Thêm nhạc" : "Đổi nhạc này"}
          <span className="sr-only"> cho {ten.toLowerCase()}</span>
        </button>
        {!goNhac && (
          <button type="button" className="btn btn--line" disabled={dang} onClick={go}>
            Gỡ nhạc từ lượt này
            <span className="sr-only"> ({ten.toLowerCase()})</span>
          </button>
        )}
        {s.o !== null && (
          <button type="button" className="btn btn--line" disabled={dang} onClick={() => chayBo(async () => xong(await actionRemoveTrackEntry(bookId, s.roundId), false))}>
            Bỏ ô này
            <span className="sr-only"> của {ten.toLowerCase()}</span>
          </button>
        )}
      </div>
      {mo && (
        <div className="moc__mo">
          <form className="form" onSubmit={submit} noValidate>
            <MusicField state={nhac} disabled={dangLuu} />
            <div className="form__nut">
              <Button type="submit" disabled={dangLuu} aria-busy={dangLuu}>{dangLuu ? "Đang lưu" : "Lưu"}</Button>
              {/* Huy phai tra o ve dung gia tri dang luu: khong thi lan mo sau se hien lai lua chon dang do cua lan truoc. */}
              <button type="button" className="btn btn--line" disabled={dangLuu} onClick={() => { nhac.setMusic(s.o?.youtubeId === undefined || s.o.youtubeId === null ? "" : youtubeLink(s.o.youtubeId)); setLoi(null); setMo(false); }}>Hủy</button>
            </div>
          </form>
        </div>
      )}
      {loi !== null && <p className="moc__loi" role="alert">{loi}</p>}
    </li>
  );
}

/**
 * Muc "Nhac theo luot" cua man Sua sach. Cung hinh dang voi muc bia, khac o ba diem: khong co hinh bia ma co mot not
 * nhac nho, co nut dat O GO NHAC (o that mang ma video rong, nghia la tu luot do cuon im), va khong co bat bien "luon
 * con it nhat mot o" - cuon khong o nhac nao la cuon khong co nhac nen, dung nhu truoc day.
 */
export function TrackTimeline({ bookId, slots, now }: TrackTimelineProps) {
  return (
    <section className="muc moc-muc" aria-labelledby="nhac-theo-luot">
      <h2 className="muc__t d" id="nhac-theo-luot">Nhạc theo lượt</h2>
      <p className="muc__x">Cuốn phát bản nhạc mới nhất. Gỡ nhạc từ một lượt thì từ lượt đó cuốn im.</p>
      <ol className="moc-ds">
        {slots.map((s) => <Dong key={s.roundId ?? "mo-dau"} s={s} bookId={bookId} now={now} />)}
      </ol>
    </section>
  );
}
