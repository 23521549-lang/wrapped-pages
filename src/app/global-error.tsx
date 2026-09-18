"use client";

import "@/styles/globals.css";
import LoiTrang from "./error";
import { lopPhong } from "./phong";

/**
 * Chi hien khi CHINH layout goc hong (error.tsx boc moi trang nhung khong boc layout goc). Thay the ca layout
 * goc nen tu dung <html>/<body>, tu nap CSS va phong chu, va dat tieu de bang the <title> cua React vi tep nay
 * khong duoc xuat metadata (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md,
 * muc Global Error).
 *
 * Vi sao tep nay co ich du trang tinh _global-error cua Next van khong co nonce: da do tren ban
 * phat hanh, layout goc nem loi giua mot request thi Next KHONG phuc vu trang tinh do, ma tra mot vo HTML
 * rong (html#__next_error__) dung ngay trong request, mang nonce tren moi the script; trinh duyet chay cac
 * script do roi ve tep nay o client. Nen o duong nay tep nay chay duoi CSP binh thuong, va vi CSS cua web la
 * tep .css ('self') chu khong phai the <style> noi tuyen, trang giu duoc giay va mau cua web. Khong co tep nay
 * thi Next ve trang mac dinh tieng Anh, co the <style> noi tuyen khong nonce bi CSP chan nen mat mau.
 * Trang tinh _global-error chi con duoc phuc vu khi chinh buoc dung trang loi cung hong; tep nay khong doi
 * duoc trang do (Next dung san no bang giao dien mac dinh cua minh, co hay khong co tep nay cung vay).
 */
export default function LoiToanCuc({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <html lang="vi" className={lopPhong}>
      <body>
        <title>Món Quà Của Em</title>
        <LoiTrang error={error} retry={retry} />
      </body>
    </html>
  );
}
