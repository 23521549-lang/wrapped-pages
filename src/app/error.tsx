"use client";

import Link from "next/link";

/**
 * Ranh gioi loi cua moi trang (node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/error.md).
 * No boc trang nhung KHONG boc layout goc, nen van nam trong <html>/<body> cua layout goc: dung dong theo
 * request, co nonce cua CSP, co phong chu va mau cua web. Chi mot loi trong chinh layout goc moi roi xuong
 * trang du phong tinh cua Next.
 *
 * Khong bao gio in error.message: loi tu may chu co the mang chi tiet noi bo (ten bang, chuoi ket noi...).
 * Ban phat hanh da thay message do bang mot cau chung, nhung luc phat trien thi khong, va loi tu client
 * thi giu nguyen message goc; khong hien no o bat ky dau thi khong phai nho khi nao an toan.
 *
 * Co hien error.digest: day la ma bam Next sinh cho loi may chu, khong chua noi dung loi, va la soi day
 * duy nhat noi dieu nguoi dung thay voi dong log tuong ung cua may chu (tai lieu Next goi y dung dung vay).
 * Loi sinh ra o client khong co digest, khi do dong ma khong hien.
 *
 * retry (on dinh tu Next 16.3) lay lai du lieu va dung lai trang: loi thuong gap nhat la database tam thoi
 * khong toi duoc, nen thu lai la dung viec. reset thi chi dung lai ma khong lay lai, khong giup gi o day.
 */
export default function LoiTrang({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="shell shell--hep man">
      <div className="head">
        <div>
          <h1 className="d">Trang chưa mở được</h1>
          <p className="head__sub">
            Có trục trặc khi mở trang này, không phải do bạn. Thử lại sau một lát, hoặc quay về trang chính.
          </p>
        </div>
      </div>
      <div className="muc">
        <div className="form__nut">
          <button type="button" className="btn" onClick={() => retry()}>Thử lại</button>
          <Link className="btn btn--quiet" href="/">Về trang chính</Link>
        </div>
        {error.digest && <p className="meta">Mã lỗi: {error.digest}</p>}
      </div>
    </main>
  );
}
