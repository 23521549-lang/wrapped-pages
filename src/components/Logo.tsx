/** Id bo loc muc cua logo, khai trong InkDefs (layout goc). Nhe tay hon bo loc bia vi net logo nho. */
export const MUC_LOGO = "muc-logo";

/**
 * Logo "sach that no": cuon sach mo ve bang net co, soi dau trang o gay vuon len thanh chiec no. Cuon nhat ky chinh
 * la mon qua. Mau la currentColor; chi trang tri, ten web di kem ngay canh nen logo an voi trinh doc man hinh.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <g filter={`url(#${MUC_LOGO})`} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M50 44 C41 38 27 37 16 41 L16 80 C27 76 41 77 50 83 C59 77 73 76 84 80 L84 41 C73 37 59 38 50 44 Z" strokeWidth={4.2} />
        <path d="M50 45 L50 82" strokeWidth={3.2} />
        <path d="M50 38 C44 26 30 24 32 33 C34 40 45 39 50 38 C55 39 66 40 68 33 C70 24 56 26 50 38 Z" strokeWidth={3.6} />
        <path d="M50 38 C47 44 44 47 40 50 M50 38 C53 44 56 47 60 50" strokeWidth={3} />
        <circle cx={50} cy={38} r={2.6} fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}
