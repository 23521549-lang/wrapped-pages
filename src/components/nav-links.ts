/*
 * Bon muc cua thanh dieu huong chinh. Tach khoi AppNav de khung giu cho (KhungCho.tsx) ve cung thanh ma khong nhap
 * next/link: loading.tsx nhap thanh phan client nao thi Next chen the script cua no ma khong mang nonce CSP.
 */
export type NavSection = "ke-sach" | "ban-nhap" | "dau-thoi-gian" | "cai-dat";

export const LINKS: readonly { key: NavSection; href: string; label: string }[] = [
  { key: "ke-sach", href: "/ke-sach", label: "Kệ sách" },
  { key: "ban-nhap", href: "/ban-nhap", label: "Bản nháp" },
  { key: "dau-thoi-gian", href: "/dau-thoi-gian", label: "Dấu thời gian" },
  { key: "cai-dat", href: "/cai-dat", label: "Cài đặt" },
];
