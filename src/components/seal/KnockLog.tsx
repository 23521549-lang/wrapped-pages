import { useId } from "react";
import { initialOf } from "@/lib/initial";
import type { KnockEntry } from "@/lib/seal/types";
import { momentLabel } from "@/lib/when";

/**
 * Nhat ky go cua cua chu sach: ai da thu, go gi, luc nao, dung hay sai. Moi nhat o tren. Chi chu
 * sach nhan duoc knocks tu may chu, nen nguoi kia khong bao gio thay danh sach nay.
 */
export function KnockLog({ knocks, partner, now }: { knocks: readonly KnockEntry[]; partner: string; now: Date }) {
  const id = useId();
  const moiTruoc = knocks.map((_, i) => knocks[knocks.length - 1 - i]);
  return (
    <>
      <h3 className="d" id={id}>Nhật ký gõ cửa</h3>
      {moiTruoc.length === 0 ? (
        <p className="go-cua__trong">Chưa ai gõ cửa.</p>
      ) : (
        <ol className="go-cua" aria-labelledby={id}>
          {moiTruoc.map((k) => (
            <li key={`${k.at.toISOString()}-${k.guess}`} className="go-cua__dong">
              <span className="av" aria-hidden="true">{initialOf(partner)}</span>
              <span className="go-cua__chuoi">“{k.guess}”</span>
              <span className="go-cua__luc">{partner} · {momentLabel(k.at, now)}</span>
              <span className={k.correct ? "chip chip--key" : "chip"}>{k.correct ? "Đúng" : "Sai"}</span>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
