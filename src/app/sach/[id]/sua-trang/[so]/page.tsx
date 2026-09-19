import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { readPageForEdit } from "@/server/library/edit-page";
import { getMediaStore } from "@/server/media/get-store";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { PageEditor } from "@/components/editor/PageEditor";

/**
 * Man sua mot to da dang cua chu sach. Sach nguoi kia, sach la, vi tri la deu 404 nhu moi cho khac. To niem phong chi
 * co vi tri: HTML tra ve khong chua chu nao cua to.
 */
export default async function SuaTrang({ params }: { params: Promise<{ id: string; so: string }> }) {
  await connection();
  const [me, { id, so }] = await Promise.all([requireMe(), params]);
  // Mau chat thay Number(): khong nhan 1e3, 0x10, khoang trang hay so 0 dau.
  if (!/^[1-9][0-9]{0,4}$/.test(so)) notFound();
  const page = await readPageForEdit(db, me.accountId, id, Number(so));
  if (!page) notFound();
  if (page.kind === "sealed") {
    return (
      <>
        <AppNav me={me} current="ke-sach" subpage />
        <main className="shell man">
          <div className="trong">
            <h1 className="trong__t d">Không sửa được</h1>
            <p>Trang {page.position} nằm trong niêm phong nên phải giữ nguyên như lúc đăng.</p>
            <Link className="btn" href={`/sach/${id}?trang=${page.position}`}>Về trang {page.position}</Link>
          </div>
        </main>
      </>
    );
  }
  return (
    <>
      <AppNav me={me} current="ke-sach" subpage sticky={false} />
      {/* key theo moc phien ban: "Tai lai" (router.refresh) dung lai trinh soan thao tu ban moi nhat. */}
      <PageEditor
        key={page.version}
        bookId={id}
        bookTitle={page.bookTitle}
        position={page.position}
        initialDoc={page.content}
        version={page.version}
        publishedAt={page.publishedAt.toISOString()}
        editedAt={page.editedAt?.toISOString() ?? null}
        now={new Date().toISOString()}
        author={me.nickname}
        mediaEnabled={getMediaStore() !== null}
      />
    </>
  );
}
