import Link from "next/link";
import type { Me } from "@/server/web/guard";

export type NavSection = "ke-sach" | "ban-nhap" | "cai-dat";

const LINKS: { key: NavSection; href: string; label: string }[] = [
  { key: "ke-sach", href: "/ke-sach", label: "Kệ sách" },
  { key: "ban-nhap", href: "/ban-nhap", label: "Bản nháp" },
  { key: "cai-dat", href: "/cai-dat", label: "Cài đặt" },
];

/**
 * Thanh dieu huong chinh. Khong co nen vien thuoc: muc dang o la chu dam mau muc kem gach duoi 2px sat mep
 * duoi thanh. Nguoi dang vao hien bang chu, khong co o tron. current la muc dang o. subpage = true khi dang o man con cua muc do
 * (tao, sua, doc sach): lien ket mang aria-current="true" thay vi "page".
 * sticky = false cho man co thanh dinh rieng ben duoi (man viet), de hai thanh khong chong nhau, va cho man doc
 * sach co nhac, de nav khong bao gio de len trinh phat YouTube.
 */
export function AppNav({ me, current, subpage = false, sticky = true }: {
  me: Me;
  current: NavSection | null;
  subpage?: boolean;
  sticky?: boolean;
}) {
  return (
    <nav className={sticky ? "nav" : "nav nav--tinh"} aria-label="Điều hướng chính">
      <div className="nav__in shell">
        <Link className="wordmark d" href="/ke-sach">
          <span className="bead" aria-hidden="true" />Món Quà Của Em
        </Link>
        <div className="nav__links">
          {LINKS.map((l) => (
            <Link
              key={l.key}
              className="nav__link"
              href={l.href}
              aria-current={l.key === current ? (subpage ? "true" : "page") : undefined}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="nav__right">
          <span className="who">Đang vào: <b>{me.nickname}</b></span>
          {/* /viet chuyen huong luc bam, nen tai truoc khong co gi de dung lai. Nut cap chu: hanh dong chinh cua
              moi man nam trong man, khong nam tren thanh dieu huong. */}
          <Link className="btn btn--chu" href="/viet" prefetch={false}>Trang mới</Link>
        </div>
      </div>
    </nav>
  );
}
