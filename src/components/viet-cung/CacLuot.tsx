"use client";

import { useId } from "react";
import Link from "next/link";
import { useShownRange } from "@/components/reader/ShownSheets";
import { shownRound } from "@/lib/round-reply";
import { tenHienLuot } from "@/lib/viet-cung";

/** Mot luot trong muc luc cua sach viet cung, dung nhung truong cot phai can. */
export type LuotMucLuc = {
  id: string; ordinal: number; ten: string | null; first: number; last: number;
  /** Biet danh nguoi viet luot ("Bạn" khong dung o day: muc luc ghi ten that cua ca hai). */
  ai: string;
  /** Loi hoi dap cua luot tu truoc khi cuon thanh sach viet cung (chi doc), hay null. */
  hoiDap: string | null;
};

/**
 * Cot phai cua man doc sach viet cung (5c muc G3), thay khung Loi hoi dap: muc luc theo luot (so thu tu, ten luot, nguoi
 * viet va trang dau). Luot dang mo (theo cac to dang hien, nhu khung hoi dap) co nen nhat va aria-current; bam mot luot
 * la toi trang dau cua luot. Luot co loi hoi dap cu thi khi dang mo, loi do hien duoi danh sach, chi doc.
 */
export function CacLuot({ bookId, luot }: { bookId: string; luot: readonly LuotMucLuc[] }) {
  const tieuDe = useId();
  const shown = useShownRange();
  const dang = (shown ? shownRound(luot, shown) : undefined) ?? luot[0];
  return (
    <section className="hoi-dap cac-luot" aria-labelledby={tieuDe}>
      <div className="hoi-dap__dau">
        <h2 className="d hoi-dap__t" id={tieuDe}>Các lượt</h2>
        <p className="meta">{luot.length} lượt, hai người viết</p>
      </div>
      <ol className="cac-luot__ds">
        {luot.map((l) => {
          const laDang = l.id === dang?.id;
          return (
            <li key={l.id}>
              <Link
                className={laDang ? "luot luot--dang" : "luot"}
                href={`/sach/${bookId}?trang=${l.first}`}
                scroll={false}
                aria-current={laDang ? "true" : undefined}
              >
                <span className="luot__so">{l.ordinal}</span>
                <span className="luot__chu">
                  <span className="luot__ten">{tenHienLuot(l.ten, l.ordinal)}</span>
                  <span className="luot__phu">{l.ai}, trang {l.first}</span>
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      {dang?.hoiDap && (
        <div className="cac-luot__hoi">
          <p className="cac-luot__nhan">Lời hồi đáp từ trước khi viết cùng</p>
          <p className="hoi-dap__chu">{dang.hoiDap}</p>
        </div>
      )}
    </section>
  );
}
