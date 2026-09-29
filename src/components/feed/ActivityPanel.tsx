import { Fragment } from "react";
import Link from "next/link";
import { feedDays } from "@/lib/feed/days";
import { feedLine, type FeedNames, type FeedSentence, type TenBaiHat } from "@/lib/feed/line";
import type { FeedItem } from "@/lib/feed/types";
import { timeLabel } from "@/lib/when";

export type ActivityPanelProps = {
  /** Dong Hoat dong da loc theo nguoi xem (listActivity), moi nhat truoc. */
  items: readonly FeedItem[];
  /** Cung now voi luc doc, de nhan Hom nay va Hom qua khop dung lan doc do. */
  now: Date;
  partnerName: string;
  /** Ten bai va kenh cua cac bai trong dong doi nhac, lay tu YouTube o may chu (tenCacBai). */
  baiHat?: TenBaiHat;
};

/**
 * Cau cua dong: ten nguoi lam o dau doan dau ("Bạn" hoac biet danh nguoi kia) in dam, thay cho o tron chu cai dau
 * truoc day; doan dam (ten sach, ten moi) in dam. Dong hen gio tu mo khong co ai lam nen khong co ten; cau ma ca cau da
 * dam (mat khau bi doi) giu nguyen.
 */
function Cau({ doan, ai }: { doan: FeedSentence; ai: string | null }) {
  // Khoa theo noi dung: mot cau khong co hai doan trung nhau (doi ten A thanh A khong bao gio thanh dong).
  return doan.map((d, i) => {
    const khoa = `${d.dam ? "dam" : "thuong"}:${d.chu}`;
    if (d.dam) return <b key={khoa}>{d.chu}</b>;
    if (i > 0 || ai === null || !d.chu.startsWith(`${ai} `)) return <Fragment key={khoa}>{d.chu}</Fragment>;
    // Fragment chu khong phai span: chu sau ten nam ngay canh doan dam, nhu cau cu (khoang trang cuoi khong bi cat khi
    // tinh ten kha truy cua lien ket).
    return (
      <Fragment key={khoa}>
        <strong className="hoat-dong__ai">{ai}</strong>
        {d.chu.slice(ai.length)}
      </Fragment>
    );
  });
}

/** Mot dong: dong co sach la mot lien ket phu ca dong, dong khong gan sach la khoi thuong. */
function Dong({ item, names }: { item: FeedItem; names: FeedNames }) {
  const line = feedLine(item, names);
  const ai = line.avatar === "hen-gio" ? null : line.avatar === "me" ? "Bạn" : names.partner;
  const noiDung = (
    <>
      <p className="hoat-dong__chu">
        <Cau doan={line.sentence} ai={ai} />
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
export function ActivityPanel({ items, now, partnerName, baiHat }: ActivityPanelProps) {
  const names: FeedNames = { partner: partnerName, baiHat };
  return (
    <section className="hoat-dong">
      <div className="hoat-dong__dau"><h2>Hoạt động</h2></div>
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
                  <li key={item.id}><Dong item={item} names={names} /></li>
                ))}
              </ol>
            </div>
          ))}
        </section>
      )}
    </section>
  );
}
