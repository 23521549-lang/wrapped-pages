import Link from "next/link";
import { feedDays } from "@/lib/feed/days";
import { feedLine, type FeedNames } from "@/lib/feed/line";
import type { FeedItem } from "@/lib/feed/types";
import { initialOf } from "@/lib/initial";
import { timeLabel } from "@/lib/when";

export type ActivityPanelProps = {
  /** Dong Hoat dong da loc theo nguoi xem (listActivity), moi nhat truoc. */
  items: readonly FeedItem[];
  /** Cung now voi luc doc, de nhan Hom nay va Hom qua khop dung lan doc do. */
  now: Date;
  /** Biet danh nguoi xem, cho o tron cua dong "Bạn ...". */
  myName: string;
  partnerName: string;
};

/** Dong ho cua dong hen gio tu mo. */
const DONG_HO = (
  <svg viewBox="0 0 16 16">
    <circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
    <path d="M8 5v3.2l2 1.3" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/** Mot dong: dong co sach la mot lien ket phu ca dong, dong khong gan sach la khoi thuong. */
function Dong({ item, names, myName }: { item: FeedItem; names: FeedNames; myName: string }) {
  const line = feedLine(item, names);
  const noiDung = (
    <>
      {line.avatar === "hen-gio" ? (
        <span className="av av--he" aria-hidden="true">{DONG_HO}</span>
      ) : (
        <span className="av" aria-hidden="true">{initialOf(line.avatar === "me" ? myName : names.partner)}</span>
      )}
      <p className="hoat-dong__chu">
        {line.sentence.before}
        {line.sentence.strong !== "" && <b>{line.sentence.strong}</b>}
        {line.sentence.after}
      </p>
      <time className="hoat-dong__gio" dateTime={item.at.toISOString()}>{timeLabel(item.at)}</time>
      {line.chips.length > 0 && (
        <p className="hoat-dong__phu">
          {line.chips.map((chip) => <span key={chip} className="chip">{chip}</span>)}
        </p>
      )}
      {line.extra && (
        <p className={line.extra.kind === "loi-nhan" ? "hoat-dong__ghi hoat-dong__ghi--loi-nhan" : "hoat-dong__ghi"}>
          {line.extra.kind === "loi-nhan" && <span className="sr-only">Lời nhắn: </span>}
          {line.extra.text}
        </p>
      )}
    </>
  );
  return line.href === null
    ? <div className="hoat-dong__dong">{noiDung}</div>
    : <Link className="hoat-dong__dong" href={line.href}>{noiDung}</Link>;
}

/**
 * Khung Hoat dong cua ke sach. Chi ve du lieu may chu da loc cho nguoi xem.
 * Co dong thi co vung cuon an thanh cuon: vung nhan focus (tabIndex 0) de cuon bang phim, moi ngay mot nhom co
 * tieu de dinh mep tren. Chua co dong nao thi chi co o trong, khong vung cuon, khong vet mo.
 */
export function ActivityPanel({ items, now, myName, partnerName }: ActivityPanelProps) {
  const names: FeedNames = { partner: partnerName };
  return (
    <section className="hoat-dong">
      <div className="hoat-dong__dau"><h2 className="d">Hoạt động</h2></div>
      {items.length === 0 ? (
        <div className="hoat-dong__trong">
          <b>Chưa có gì mới</b>
          <p className="meta">{partnerName} đăng trang hay mở một trang khóa thì tin hiện ở đây.</p>
        </div>
      ) : (
        // section co nhan la vai tro region. Thanh cuon an nen vung phai nhan focus de cuon bang phim.
        // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- vung cuon an thanh cuon, khong co cach cuon bang phim nao khac
        <section className="hoat-dong__cuon" tabIndex={0} aria-label="Hoạt động gần đây">
          {feedDays(items, now).map((day) => (
            <div key={day.key} className="hoat-dong__nhom">
              <h3 className="hoat-dong__ngay">{day.label}</h3>
              <ol className="hoat-dong__ds">
                {day.items.map((item) => (
                  <li key={item.id}><Dong item={item} names={names} myName={myName} /></li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}
