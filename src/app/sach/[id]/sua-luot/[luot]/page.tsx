import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { readRoundForEdit } from "@/server/library/edit-round";
import { getMediaStore } from "@/server/media/get-store";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { RoundEditor } from "@/components/editor/RoundEditor";
import { joinSheets } from "@/lib/doc/join";
import { roundSheetParam, SO_TRANG } from "@/lib/round";

/**
 * Man sua mot luot da dang cua chu sach. Sach nguoi kia, sach la, luot la deu 404 nhu moi cho khac. Luot niem phong con
 * dong voi nguoi kia chi co so thu tu va to dau: HTML tra ve khong chua chu nao cua luot.
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
  if (round.kind === "sealed") {
    return (
      <>
        <AppNav me={me} current="ke-sach" subpage />
        <main className="shell man">
          <div className="trong">
            <h1 className="trong__t d">Không sửa được</h1>
            <p>Lượt {round.ordinal} đang niêm phong. Khi niêm phong được mở, bạn sửa được lượt này.</p>
            <Link className="btn" href={`/sach/${id}?trang=${round.first}`}>Về trang {round.first}</Link>
          </div>
        </main>
      </>
    );
  }
  return (
    <>
      <AppNav me={me} current="ke-sach" subpage sticky={false} />
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
      />
    </>
  );
}
