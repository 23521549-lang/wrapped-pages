import type { ReactNode } from "react";
import { MUC_LOGO } from "@/components/Logo";
import { COVERS, type CoverKey } from "@/lib/book";

/** Id cua bo loc muc loang, khai mot lan trong InkDefs (layout goc), moi bia tro toi no. */
export const MUC_LOANG = "muc-loang";

/** Ten tranh ve cua tung bia, dung giua cau (dong bia du phong cua bia anh). */
export const COVER_NAME: Record<CoverKey, string> = {
  "nui-xa": "Núi xa",
  "khom-truc": "Khóm trúc",
  "trang-nuoc": "Trăng trên nước",
  "chim-bay": "Chim bay qua bờ nước",
};

/** Nhan cho nguoi dung trinh doc man hinh, dung o bo chon bia: chu Bia kem ten tranh viet thuong. */
export const COVER_LABEL = Object.fromEntries(COVERS.map((c) => [c, `Bìa ${COVER_NAME[c].toLowerCase()}`])) as Record<CoverKey, string>;

/**
 * Net ve cua bon bia, ve tay co tinh khong deu. Moi bia boc trong mot <g> dung bo loc muc loang (#muc-loang) khai
 * mot lan trong layout goc (InkDefs), nen mep net xo nhe va loang vao giay nhu muc tau.
 */
const VE: Record<CoverKey, ReactNode> = {
  "nui-xa": (
    <g filter={`url(#${MUC_LOANG})`}>
      <path d="M214 30 C230 27 243 40 241 52 C240 66 226 71 214 67 C201 64 196 51 200 42 C203 35 208 31 214 30 Z" fill="currentColor" opacity=".13" />
      <path d="M-6 136 C20 118 38 96 64 104 C84 110 92 126 118 120 C146 113 156 88 182 92 C204 95 214 70 240 84 C262 96 276 124 306 116 L306 190 L-6 190 Z" fill="currentColor" opacity=".15" />
      <path d="M-6 152 C30 140 52 124 86 138 C110 148 132 158 164 142 C188 130 206 112 236 124 C258 133 280 148 306 140 L306 190 L-6 190 Z" fill="currentColor" opacity=".25" />
      <path d="M-6 168 C40 160 72 150 118 162 C160 172 196 166 232 158 C262 152 284 160 306 156 L306 190 L-6 190 Z" fill="currentColor" opacity=".38" />
    </g>
  ),
  "khom-truc": (
    <g filter={`url(#${MUC_LOANG})`} stroke="currentColor" fill="none" strokeLinecap="round">
      <path d="M78 190 C77 150 80 110 78 34" strokeWidth="5.5" opacity=".34" />
      <path d="M126 190 C128 150 124 100 127 62" strokeWidth="3.5" opacity=".24" />
      <path d="M44 190 C45 150 42 120 45 86" strokeWidth="2.5" opacity=".18" />
      <g strokeWidth="3.2" opacity=".3">
        <path d="M78 60 q24 -16 48 -5" /><path d="M78 84 q-22 -18 -46 -9" />
        <path d="M79 108 q28 -14 52 -1" /><path d="M127 92 q20 -14 42 -3" />
        <path d="M45 112 q-18 -12 -36 -3" />
      </g>
    </g>
  ),
  "trang-nuoc": (
    <g filter={`url(#${MUC_LOANG})`}>
      <path d="M150 27 C168 26 181 41 180 58 C179 75 165 88 149 87 C132 86 120 73 121 57 C122 40 134 28 150 27 Z" fill="currentColor" opacity=".15" />
      <g stroke="currentColor" fill="none" strokeLinecap="round" strokeWidth="2.6">
        <path d="M36 122 q26 -10 54 -1 t58 1 t52 -1 t56 1" opacity=".3" />
        <path d="M18 142 q34 -11 62 -1 t66 1 t60 -1 t66 1" opacity=".24" />
        <path d="M46 160 q28 -10 58 -1 t62 1 t58 0" opacity=".18" />
      </g>
    </g>
  ),
  "chim-bay": (
    <g filter={`url(#${MUC_LOANG})`}>
      <path d="M-6 130 C40 118 90 112 150 124 C200 134 250 128 306 116 L306 190 L-6 190 Z" fill="currentColor" opacity=".17" />
      <path d="M-6 156 C50 146 100 148 150 154 C206 162 250 156 306 148 L306 190 L-6 190 Z" fill="currentColor" opacity=".29" />
      <g stroke="currentColor" fill="none" strokeLinecap="round" strokeWidth="2.6" opacity=".42">
        <path d="M84 57 q10 -11 22 -1" /><path d="M106 56 q12 -9 21 1" />
        <path d="M154 35 q8 -9 18 0" /><path d="M172 35 q10 -7 17 1" />
        <path d="M198 69 q8 -8 16 0" /><path d="M214 69 q9 -6 15 1" />
      </g>
    </g>
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

/**
 * Bo loc muc dung chung cho moi bia, dat MOT lan trong layout goc (khong lap moi bia, khong trung id).
 * Nhieu tan so thap xo dich net ve vai px roi nhoe rat nhe cho mep an vao giay; lop nhieu thu hai lam muc tham
 * khong deu thanh vet loang lon. Bo loc SVG noi tuyen khong can mien CSP nao.
 */
export function InkDefs() {
  return (
    <svg className="muc-dinh" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <filter id={MUC_LOANG} x="-8%" y="-8%" width="116%" height="116%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.03 0.05" numOctaves={3} seed={11} result="song" />
          <feDisplacementMap in="SourceGraphic" in2="song" scale={9} xChannelSelector="R" yChannelSelector="G" result="xo" />
          <feGaussianBlur in="xo" stdDeviation={0.9} result="nhoe" />
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves={2} seed={4} result="hat" />
          <feColorMatrix in="hat" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.3 1.45" result="hatA" />
          <feComposite in="nhoe" in2="hatA" operator="in" />
        </filter>
        {/* Logo: net nho nen chi xo dich nhe va nhoe rat it, khong co lop muc tham. */}
        <filter id={MUC_LOGO} x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves={3} seed={7} result="song" />
          <feDisplacementMap in="SourceGraphic" in2="song" scale={3.2} xChannelSelector="R" yChannelSelector="G" result="xo" />
          <feGaussianBlur in="xo" stdDeviation={0.35} />
        </filter>
      </defs>
    </svg>
  );
}
