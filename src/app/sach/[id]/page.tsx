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
import { musicGate } from "@/lib/music-gate";
import { startSheet } from "@/lib/reading";
import { revealTarget, sheetLooks } from "@/lib/seal/reader";

export default async function DocSach({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const [me, { id }, query] = await Promise.all([requireMe(), params, searchParams]);
  // Mot moc gio cho ca truy van lan moi chu co thoi gian tren trang, de may chu va trinh duyet ve trung nhau.
  const now = new Date();
  const view = await readBook(db, me.accountId, id, now);
  if (!view) notFound();
  const { book, mine, sheets, seals, mark } = view;
  const count = sheets.length;
  const locked = sheets.filter((s) => s.locked).length;
  // Doc duoc thi hoac la sach cua minh, hoac la sach chia se cua nguoi kia.
  const owner = mine ? me.nickname : me.partnerNickname;
  const phu = [`${owner} viết`, `${count} trang`];
  if (mine) phu.push(book.mode === "chia-se" ? `${me.partnerNickname} đọc được` : "Chỉ mình bạn đọc");
  if (locked > 0) phu.push(`${locked} trang đang khóa`);
  // Lua chon tat nhac chi doc o sach co nhac.
  const muted = book.youtubeId !== null && (await readMusicMuted(db, me.accountId));

  const noiDung = (
    <>
      <div className="doc-head">
        <div className="doc-head__chu">
          <h1 className="d">{book.title}</h1>
          <p className="doc-head__sub">{phu.join(" · ")}</p>
        </div>
        {mine && (
          <div className="doc-head__nut">
            <Link className="btn" href={`/sach/${book.id}/viet`}>Viết tiếp</Link>
            <Link className="btn btn--line" href={`/sach/${book.id}/sua`}>Sửa sách</Link>
          </div>
        )}
      </div>

      {count === 0 ? (
        <div className="trong">
          <div className={`trong__hinh bia bia--${book.cover}`}><CoverArt cover={book.cover} /><CoverImage mediaId={book.coverMediaId} /></div>
          <h2 className="trong__t d">Chưa có trang nào.</h2>
          <p>{mine ? "Viết trang đầu rồi bấm Đăng trang, trang sẽ hiện ở đây." : `${owner} chưa đăng trang nào trong cuốn này.`}</p>
          {mine && <Link className="btn" href={`/sach/${book.id}/viet`}>Viết trang đầu</Link>}
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
          readerName={mine ? me.partnerNickname : me.nickname}
          now={now}
          start={startSheet(query.trang, count, mark, mine)}
          revealAt={revealTarget(sheets, seals, query.mo)}
          mark={mark}
          trackRead={!mine}
          mine={mine}
          editedAt={sheets.map((s) => s.editedAt)}
          editable={sheets.map((s) => mine && s.sealId === null)}
        />
      )}
    </>
  );

  return (
    <>
      {/* Sach co nhac: nav khong dinh, de khong gi (ke ca nav) de len trinh phat YouTube o moi be rong. */}
      <AppNav me={me} current="ke-sach" subpage sticky={book.youtubeId === null} />
      <main className="shell man">
        {book.youtubeId === null ? (
          noiDung
        ) : (
          <MusicRoom
            // Doi nhac (chu sach sua o tab khac roi man nay lam moi) thi gan lai the nhac voi trinh phat moi.
            key={book.youtubeId}
            videoId={book.youtubeId}
            initialMuted={muted}
            gate={musicGate(muted, query)}
            cover={<BookCover title={book.title} cover={book.cover} coverMediaId={book.coverMediaId} owner={owner} />}
          >
            {noiDung}
          </MusicRoom>
        )}
      </main>
    </>
  );
}
