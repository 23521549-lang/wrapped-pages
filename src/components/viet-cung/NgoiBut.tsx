/**
 * Dau "Hai Ngòi Bút" (dot nam 5c): hai ngoi but net muc nghieng vao nhau, dau duy nhat cua sach viet cung (ke, lua chon
 * Viet cung, dong de nghi, danh sach nhac chung). Chi ve, chu di kem noi nghia; mau theo currentColor.
 */
export function NgoiBut({ className = "ngoi" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round">
        <g transform="rotate(-17 12 21.5)">
          <path d="M9.3 3.5h5.4l.6 4.6c0 3.6-1.3 6.8-3.3 13.4-2-6.6-3.3-9.8-3.3-13.4Z" />
          <path d="M12 12.2v9.3" />
          <circle cx="12" cy="10.2" r="1" fill="currentColor" stroke="none" />
        </g>
        <g transform="rotate(17 12 21.5)">
          <path d="M9.3 3.5h5.4l.6 4.6c0 3.6-1.3 6.8-3.3 13.4-2-6.6-3.3-9.8-3.3-13.4Z" />
          <path d="M12 12.2v9.3" />
          <circle cx="12" cy="10.2" r="1" fill="currentColor" stroke="none" />
        </g>
      </g>
    </svg>
  );
}
