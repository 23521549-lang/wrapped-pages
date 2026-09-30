import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { readRoundForEdit } from "@/server/library/edit-round";
import { getMediaStore } from "@/server/media/get-store";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { RoundEditor } from "@/components/editor/RoundEditor";
import { TenLuotForm } from "@/components/viet-cung/TenLuotForm";
import { joinSheets } from "@/lib/doc/join";
import { roundSheetParam, SO_TRANG } from "@/lib/round";

/**
 * Man sua mot luot da dang cua chu sach. Sach nguoi kia, sach la, luot la deu 404 nhu moi cho khac. Luot niem phong con
 * dong voi nguoi kia cung sua duoc (chu du an 28/09): chi chu sach toi duoc day, nguoi kia khong bao gio nhan noi dung.
 */
export default async function SuaLuot({ params, searchParams }: {
  params: Promise<{ id: string; luot: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  await connection();
  const [me, { id, luot }, query] = await Promise.all([requireMe(), params, searchParams]);
  if (!SO_TRANG.test(luot)) notFound();
  const round = await readRoundForEdit(db, me.accountId, id, Number(luot));
  if (!round) notFound();
  return (
    <>
      <AppNav me={me} current="ke-sach" subpage sticky={false} linhVat={false} />
      {/* key theo moc phien ban: "Tai lai" (router.refresh) dung lai trinh soan thao tu ban moi nhat. */}
      <RoundEditor
        key={round.version}
        bookId={id}
        bookTitle={round.bookTitle}
        roundId={round.id}
        ordinal={round.ordinal}
        first={round.first}
        initialDoc={joinSheets(round.sheets)}
        version={round.version}
        publishedAt={round.publishedAt.toISOString()}
        editedAt={round.editedAt?.toISOString() ?? null}
        now={new Date().toISOString()}
        startSheet={roundSheetParam(query.trang, round.sheets.length)}
        author={me.nickname}
        mediaEnabled={getMediaStore() !== null}
        niemPhong={round.niemPhong}
        partnerNickname={me.partnerNickname}
        tenLuot={round.vietCung
          ? <TenLuotForm key={round.ten ?? ""} bookId={id} roundId={round.id} ordinal={round.ordinal} ten={round.ten} />
          : undefined}
      />
    </>
  );
}
