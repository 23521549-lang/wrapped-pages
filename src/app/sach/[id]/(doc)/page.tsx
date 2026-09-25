import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { readMusicMuted } from "@/server/identity/prefs";
import { readBook } from "@/server/library/pages";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { CoverArt } from "@/components/book/CoverArt";
import { CoverImage } from "@/components/book/CoverImage";
import { BookCover } from "@/components/music/BookCover";
import { MusicRoom } from "@/components/music/MusicRoom";
import { Reader } from "@/components/reader/Reader";
import { SachCoCong } from "@/components/reader/SachCoCong";
import { RoundReplyPanel } from "@/components/reader/RoundReplyPanel";
import { ShownSheetsProvider } from "@/components/reader/ShownSheets";
import { congMoSach } from "@/lib/cong-mo-sach";
import { startSheet } from "@/lib/reading";
import { roundEditPath } from "@/lib/round";
import { replyRounds } from "@/lib/round-reply";
import { revealTarget, sheetLooks } from "@/lib/seal/reader";

export default async function DocSach({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const [me, { id }, query] = await Promise.all([requireMe(), params, searchParams]);
  // Mot moc gio cho ca truy van lan moi chu co thoi gian tren trang, de may chu va trinh duyet ve trung nhau.
  const now = new Date();
  // Lua chon tat nhac la cua chinh nguoi xem, khong phu thuoc cuon sach, nen doc song song; chi dung khi sach co nhac.
  const [view, tatNhac] = await Promise.all([readBook(db, me.accountId, id, now), readMusicMuted(db, me.accountId)]);
  if (!view) notFound();
  const { book, mine, sheets, seals, rounds, replies, seen, firstUnread } = view;
  const count = sheets.length;
  // Nut "Sua trang N" chi cho chu sach: tro toi man sua luot chua to do, mo ngay to do. Luot con niem phong voi nguoi kia
  // (hay nguoi xem khong phai chu sach) thi null.
  const luotCua = new Map(rounds.map((r) => [r.id, r]));
  const editHref = sheets.map((s) => {
    const r = luotCua.get(s.roundId);
    return mine && r && !r.sealed ? roundEditPath(book.id, r.ordinal, s.position - r.first + 1) : null;
  });
  const start = startSheet(query.trang, count, firstUnread, mine);
  // Nguoi doc la nguoi khong phai chu sach: cung la nguoi hoi dap.
  const nguoiDoc = mine ? me.partnerNickname : me.nickname;
  // Khung Loi hoi dap chi co voi sach dang chia se va da co to; sach rieng tu khong co (readBook cung khong doc loi).
  const hoiDap = book.mode === "chia-se" && count > 0
    ? <RoundReplyPanel rounds={replyRounds(rounds, replies)} mine={mine} replierName={nguoiDoc} now={now} />
    : null;
  const locked = sheets.filter((s) => s.locked).length;
  // Doc duoc thi hoac la sach cua minh, hoac la sach chia se cua nguoi kia.
  const owner = mine ? me.nickname : me.partnerNickname;
  const phu = [`${owner} viết`, `${count} trang`];
  if (mine) phu.push(book.mode === "chia-se" ? `${me.partnerNickname} đọc được` : "Chỉ mình bạn đọc");
  if (locked > 0) phu.push(`${locked} trang đang khóa`);
  const muted = book.youtubeId !== null && tatNhac;
  // Moi cuon deu mo qua tam bia, co nhac hay khong (chu du an chot 26/09); chi loi vao ?trang hay ?mo mo thang sach.
  const cong = congMoSach(query);
  const bia = <BookCover title={book.title} cover={book.cover} coverMediaId={book.coverMediaId} owner={owner} />;

  const noiDung = (
    <>
      <div className="doc-head">
        <div className="doc-head__chu">
          <h1 className="d">{book.title}</h1>
          <p className="doc-head__sub">{phu.join(" · ")}</p>
        </div>
        {mine && (
          <div className="doc-head__nut">
            <Link className="btn" href={`/sach/${book.id}/viet-tiep`}>Viết tiếp</Link>
            <Link className="btn btn--line" href={`/sach/${book.id}/sua`}>Sửa sách</Link>
          </div>
        )}
      </div>

      {count === 0 ? (
        <div className="trong">
          <div className={`trong__hinh bia bia--${book.cover}`}><CoverArt cover={book.cover} /><CoverImage mediaId={book.coverMediaId} /></div>
          <h2 className="trong__t d">Chưa có trang nào.</h2>
          <p>{mine ? "Viết trang đầu rồi bấm Đăng trang, trang sẽ hiện ở đây." : `${owner} chưa đăng trang nào trong cuốn này.`}</p>
          {mine && <Link className="btn" href={`/sach/${book.id}/viet-tiep`}>Viết trang đầu</Link>}
        </div>
      ) : (
        <Reader
          // Doi ?trang (vd action mo khoa chuyen toi ?trang=N&mo=...) thi gan lai man doc tu to do. mo khong nam trong
          // key: cac lan lam moi sau khi mo (tra loi o niem phong khac, dong ho ve 0) giu nguyen man doc va cho dang doc,
          // con nghi thuc di qua revealAt.
          key={typeof query.trang === "string" ? query.trang : ""}
          bookId={book.id}
          title={book.title}
          sheets={sheets.map((s) => s.content)}
          looks={sheetLooks(sheets, seals)}
          seals={seals}
          ownerName={owner}
          readerName={nguoiDoc}
          now={now}
          start={start}
          revealAt={revealTarget(sheets, seals, query.mo)}
          seen={seen}
          trackRead={!mine}
          mine={mine}
          editedAt={sheets.map((s) => s.editedAt)}
          editHref={editHref}
        />
      )}
    </>
  );

  return (
    <>
      {/* Sach co nhac: nav khong dinh, de khong gi (ke ca nav) de len trinh phat YouTube o moi be rong. */}
      <AppNav me={me} current="ke-sach" subpage sticky={book.youtubeId === null} />
      <main className="shell man">
        {/*
         * Mot provider cho ca cot sach lan cot phai, luon co mat: dat theo dieu kien thi doi che do chia se hay dang to
         * dau o tab khac roi lam moi se gan lai MusicRoom, tuc tai lai trinh phat.
         */}
        <ShownSheetsProvider start={start}>
          {book.youtubeId === null ? (
            <SachCoCong gate={cong} cover={bia} side={hoiDap}>{noiDung}</SachCoCong>
          ) : (
            <MusicRoom
              // Doi nhac (chu sach sua o tab khac roi man nay lam moi) thi gan lai the nhac voi trinh phat moi.
              key={book.youtubeId}
              videoId={book.youtubeId}
              initialMuted={muted}
              gate={cong}
              cover={bia}
              side={hoiDap}
              dauHref={`/dau-thoi-gian/${book.id}`}
            >
              {noiDung}
            </MusicRoom>
          )}
        </ShownSheetsProvider>
      </main>
    </>
  );
}
