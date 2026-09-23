import { connection } from "next/server";
import { getMediaStore } from "@/server/media/get-store";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { BookForm } from "@/components/book/BookForm";

export default async function SachMoi() {
  await connection();
  const me = await requireMe();
  return (
    <>
      <AppNav me={me} current="ke-sach" subpage />
      <main className="shell man">
        <div className="head">
          <div>
            <h1 className="d">Sách mới</h1>
            <p className="head__sub">Đặt tên, chọn một bìa, chọn ai đọc được.</p>
          </div>
        </div>
        <BookForm book={null} nickname={me.nickname} partnerNickname={me.partnerNickname} mediaEnabled={getMediaStore() !== null} />
      </main>
    </>
  );
}
