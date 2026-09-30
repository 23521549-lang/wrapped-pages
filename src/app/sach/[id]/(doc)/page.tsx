import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { readMusicMuted } from "@/server/identity/prefs";
import { readBook } from "@/server/library/pages";
import { deNghiCuaSach } from "@/server/viet-cung/de-nghi";
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
import { CacLuot } from "@/components/viet-cung/CacLuot";
import { XinViet } from "@/components/viet-cung/XinViet";
import { congMoSach } from "@/lib/cong-mo-sach";
import { startSheet } from "@/lib/reading";
import { editHrefs } from "@/lib/round";
import { replyRounds } from "@/lib/round-reply";
import { revealTarget, sheetLooks } from "@/lib/seal/reader";
import { tenHienLuot } from "@/lib/viet-cung";

export default async function DocSach({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const [me, { id }, query] = await Promise.all([requireMe(), params, searchParams]);
  // Mot moc gio cho ca truy van lan moi chu co thoi gian tren trang, de may chu va trinh duyet ve trung nhau.
  const now = new Date();
  // Lua chon tat nhac la cua chinh nguoi xem, khong phu thuoc cuon sach, nen doc song song; chi dung khi sach co nhac.
  // De nghi viet cung cua cuon (5c): nut Xin viet cung o cuon chia se cua nguoi kia doi theo no.
  const [view, tatNhac, deNghi] = await Promise.all([
    readBook(db, me.accountId, id, now), readMusicMuted(db, me.accountId), deNghiCuaSach(db, me.accountId, id),
  ]);
  if (!view) notFound();
  const { book, mine, sheets, seals, rounds, replies, seen, firstUnread, lastPosition, vietCung } = view;
  const count = sheets.length;
  // Nguoi viet cua cuon: chu sach, hay ca hai o sach viet cung (5c).
  const laNguoiViet = mine || vietCung;
  // Nut "Sua trang N" chi o to cua luot do nguoi xem viet, ke ca to niem phong: tro toi man sua luot chua to do.
  const editHref = editHrefs(book.id, sheets, rounds);
  // Sach viet cung mo o trang chua doc dau tien cua nguoi kia (firstUnread da bo trang cua minh).
  const start = startSheet(query.trang, count, lastPosition, firstUnread, mine && !vietCung);
  // Nguoi doc la nguoi khong phai chu sach: cung la nguoi hoi dap.
  const nguoiDoc = mine ? me.partnerNickname : me.nickname;
  // Doc duoc thi hoac la sach cua minh, hoac la sach chia se cua nguoi kia.
  const owner = mine ? me.nickname : me.partnerNickname;
  const tenNguoiViet = (laCuaMinh: boolean) => (laCuaMinh ? me.nickname : me.partnerNickname);
  // Cot phai: sach viet cung co muc luc "Các lượt" (5c muc G3, thay khung hoi dap); sach chia se co khung Loi hoi dap;
  // sach rieng tu khong co (readBook cung khong doc loi).
  const cotPhai = count === 0 ? null : vietCung ? (
    <CacLuot
      bookId={book.id}
      luot={rounds.map((r) => ({
        id: r.id, ordinal: r.ordinal, ten: r.ten, first: r.first, last: r.last, ai: tenNguoiViet(r.mine),
        hoiDap: replies.find((x) => x.roundId === r.id)?.body ?? null,
      }))}
    />
  ) : book.mode === "chia-se" ? (
    <RoundReplyPanel rounds={replyRounds(rounds, replies)} mine={mine} replierName={nguoiDoc} now={now} />
  ) : null;
  // Dong dau trang cua tung to (5c muc G2): ten luot va nguoi viet, chi o sach viet cung.
  const luotCua = new Map(rounds.map((r) => [r.id, r]));
  const dauTrang = vietCung
    ? sheets.map((s) => {
      const r = luotCua.get(s.roundId);
      return r ? { ten: tenHienLuot(r.ten, r.ordinal), ai: tenNguoiViet(r.mine) } : { ten: "", ai: "" };
    })
    : undefined;
  const locked = sheets.filter((s) => s.locked).length;
  const tacGia = vietCung ? `${owner} và ${mine ? me.partnerNickname : me.nickname}` : owner;
  const phu = vietCung ? [`${tacGia} viết`, `${rounds.length} lượt`, `${count} trang`] : [`${owner} viết`, `${count} trang`];
  if (mine && !vietCung) phu.push(book.mode === "chia-se" ? `${me.partnerNickname} đọc được` : "Chỉ mình bạn đọc");
  if (locked > 0) phu.push(`${locked} trang đang khóa`);
  const muted = book.youtubeId !== null && tatNhac;
  // Moi cuon deu mo qua tam bia, co nhac hay khong (chu du an chot 26/09); chi loi vao ?trang hay ?mo mo thang sach.
  const cong = congMoSach(query);
  const bia = <BookCover title={book.title} cover={book.cover} coverMediaId={book.coverMediaId} owner={tacGia} />;
  // Xin viet cung (5c muc C2, C7): chi cuon chia se mot nguoi viet cua nguoi kia.
  const xin = deNghi?.loai === "xin-viet" && deNghi.cuaToi ? "da-xin" : deNghi?.loai === "moi-viet" && !deNghi.cuaToi ? "duoc-moi" : "khong";

  const noiDung = (
    <>
      <div className="doc-head">
        <div className="doc-head__chu">
          <h1 className="d">{book.title}</h1>
          <p className="doc-head__sub">{phu.join(" · ")}</p>
        </div>
        {laNguoiViet ? (
          <div className="doc-head__nut">
            <Link className="btn" href={`/sach/${book.id}/viet-tiep`}>Viết tiếp</Link>
            <Link className="btn btn--line" href={`/sach/${book.id}/sua`}>Sửa sách</Link>
          </div>
        ) : book.mode === "chia-se" && (
          <div className="doc-head__nut">
            <XinViet bookId={book.id} chu={owner} trangThai={xin} />
          </div>
        )}
      </div>

      {count === 0 ? (
        <div className="trong">
          <div className={`trong__hinh bia bia--${book.cover}`}><CoverArt cover={book.cover} /><CoverImage mediaId={book.coverMediaId} /></div>
          <h2 className="trong__t d">Chưa có trang nào.</h2>
          <p>{laNguoiViet ? "Viết trang đầu rồi bấm Đăng trang, trang sẽ hiện ở đây." : `${owner} chưa đăng trang nào trong cuốn này.`}</p>
          {laNguoiViet && <Link className="btn" href={`/sach/${book.id}/viet-tiep`}>Viết trang đầu</Link>}
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
          lastPosition={lastPosition}
          trackRead={!mine || vietCung}
          editedAt={sheets.map((s) => s.editedAt)}
          editHref={editHref}
          dauTrang={dauTrang}
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
            <SachCoCong gate={cong} cover={bia} side={cotPhai}>{noiDung}</SachCoCong>
          ) : (
            <MusicRoom
              // Doi nhac (chu sach sua o tab khac roi man nay lam moi) thi gan lai the nhac voi trinh phat moi.
              key={book.youtubeId}
              videoId={book.youtubeId}
              initialMuted={muted}
              gate={cong}
              cover={bia}
              side={cotPhai}
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
