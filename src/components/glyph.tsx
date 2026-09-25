/*
 * Nhung ky hieu nho dung chung o nhieu man. Tach thanh mot mo dun rieng de noi can mot ky hieu khong phai nhap ca mot
 * thanh phan lon (va moi thu no nhap theo, ke ca server action) chi de lay mot cai SVG.
 */

/** Mui ten trai hay phai cua hai nut doi thang (Lich hoa) va doi nam (Dau thoi gian). */
export function MuiTen({ huong }: { huong: "trai" | "phai" }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d={huong === "trai" ? "M12.5 4.5 L7 10 L12.5 15.5" : "M7.5 4.5 L13 10 L7.5 15.5"} fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Not nhac, cung co 12px voi cac dau hieu trang thai: khong nen, khong vien, khong bo tron. */
export function NotNhac({ go = false }: { go?: boolean }) {
  return (
    <svg className="o__ky" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M4.5 9V2.5l5-1V8" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="3" cy="9" r="1.6" fill="currentColor" />
      <circle cx="8" cy="8" r="1.6" fill="currentColor" />
      {go && <path d="M1.5 10.5L10.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />}
    </svg>
  );
}
