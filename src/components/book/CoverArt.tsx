import type { ReactNode } from "react";
import { COVERS, type CoverKey } from "@/lib/book";

/** Ten tranh ve cua tung bia, dung giua cau (dong bia du phong cua bia anh). */
export const COVER_NAME: Record<CoverKey, string> = {
  "nui-xa": "Núi xa",
  "khom-truc": "Khóm trúc",
  "trang-nuoc": "Trăng trên nước",
  "chim-bay": "Chim bay qua bờ nước",
};

/** Nhan cho nguoi dung trinh doc man hinh, dung o bo chon bia: chu Bia kem ten tranh viet thuong. */
export const COVER_LABEL = Object.fromEntries(COVERS.map((c) => [c, `Bìa ${COVER_NAME[c].toLowerCase()}`])) as Record<CoverKey, string>;

const VE: Record<CoverKey, ReactNode> = {
  "nui-xa": (
    <>
      <circle cx="222" cy="46" r="20" fill="currentColor" opacity=".14" />
      <path d="M0 132 Q46 88 92 116 Q134 142 176 104 Q220 62 262 108 Q284 132 300 122 L300 180 L0 180 Z" fill="currentColor" opacity=".16" />
      <path d="M0 150 Q54 118 104 142 Q152 164 198 132 Q244 102 300 142 L300 180 L0 180 Z" fill="currentColor" opacity=".26" />
      <path d="M0 166 Q70 150 140 164 Q212 178 300 158 L300 180 L0 180 Z" fill="currentColor" opacity=".4" />
    </>
  ),
  "khom-truc": (
    <g stroke="currentColor" fill="none" strokeLinecap="round">
      <path d="M78 180 V34" strokeWidth="5" opacity=".34" />
      <path d="M126 180 V62" strokeWidth="3.5" opacity=".24" />
      <path d="M44 180 V86" strokeWidth="2.5" opacity=".18" />
      <g strokeWidth="3" opacity=".3">
        <path d="M78 60 q28 -14 46 -6" /><path d="M78 84 q-26 -16 -44 -8" />
        <path d="M78 108 q30 -12 50 -2" /><path d="M126 92 q24 -12 40 -4" />
        <path d="M44 112 q-20 -10 -34 -4" />
      </g>
    </g>
  ),
  "trang-nuoc": (
    <>
      <circle cx="150" cy="58" r="30" fill="currentColor" opacity=".16" />
      <circle cx="150" cy="58" r="30" fill="none" stroke="currentColor" strokeWidth="1.5" opacity=".22" />
      <g stroke="currentColor" fill="none" strokeLinecap="round" strokeWidth="2.4">
        <path d="M34 122 q28 -9 56 0 t56 0 t56 0 t56 0" opacity=".3" />
        <path d="M18 142 q32 -10 64 0 t64 0 t64 0 t64 0" opacity=".24" />
        <path d="M44 160 q30 -9 60 0 t60 0 t60 0" opacity=".18" />
      </g>
    </>
  ),
  "chim-bay": (
    <>
      <path d="M0 128 Q80 112 156 124 Q232 136 300 118 L300 180 L0 180 Z" fill="currentColor" opacity=".18" />
      <path d="M0 154 Q76 144 152 154 Q228 164 300 150 L300 180 L0 180 Z" fill="currentColor" opacity=".3" />
      <g stroke="currentColor" fill="none" strokeLinecap="round" strokeWidth="2.6" opacity=".4">
        <path d="M84 56 q11 -10 22 0" /><path d="M106 56 q11 -10 22 0" />
        <path d="M154 34 q9 -8 18 0" /><path d="M172 34 q9 -8 18 0" />
        <path d="M198 68 q8 -7 16 0" /><path d="M214 68 q8 -7 16 0" />
      </g>
    </>
  ),
};

/** Net ve cua mot bia, mau la currentColor; nen gradient do class .bia--<khoa> tren phan tu cha ve. */
export function CoverArt({ cover }: { cover: CoverKey }) {
  return (
    <svg viewBox="0 0 300 180" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      {VE[cover]}
    </svg>
  );
}
