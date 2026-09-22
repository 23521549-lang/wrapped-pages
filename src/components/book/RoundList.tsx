import Link from "next/link";
import { GlyphKhoa } from "@/components/book/ShelfBook";
import { roundEditPath } from "@/lib/round";
import { pageRange } from "@/lib/seal/reader";
import { dateLabel } from "@/lib/when";
import type { RoundListItem } from "@/server/library/edit-round";

/**
 * Muc Noi dung cua man sua sach: moi luot dang mot dong "Luot 2 . trang 6 toi 11 . 20.09" (dau cham giua) kem nut
 * "Sua luot nay", hay dong "Dang niem phong" khi niem phong cua luot con dong voi nguoi kia. Ten doc cua nut kem so
 * luot de trinh doc man hinh phan biet cac nut. Chua co luot nao thi khong ve gi. Dung lai RoundListItem (mot kieu
 * duy nhat cho mot dong luot) thay vi khai them mot kieu rieng cho man hinh.
 */
export function RoundList({ bookId, rounds, now }: { bookId: string; rounds: readonly RoundListItem[]; now: Date }) {
  if (rounds.length === 0) return null;
  return (
    <section className="muc luot-muc" aria-labelledby="noi-dung">
      <h2 className="muc__t d" id="noi-dung">Nội dung</h2>
      <p className="muc__x">Sửa chữ, ảnh hay ghi âm của từng lượt đăng. Sửa xong, số trang của lượt có thể đổi.</p>
      <ol className="luot-ds">
        {rounds.map((r) => (
          <li key={r.id} className="luot">
            <p className="luot__chu">Lượt {r.ordinal} · {pageRange(r.first, r.last)} · {dateLabel(r.publishedAt, now)}</p>
            {r.sealed ? (
              <p className="luot__khoa"><GlyphKhoa />Đang niêm phong</p>
            ) : (
              <Link className="btn btn--line" href={roundEditPath(bookId, r.ordinal)}>
                Sửa lượt này<span className="sr-only"> (lượt {r.ordinal})</span>
              </Link>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
