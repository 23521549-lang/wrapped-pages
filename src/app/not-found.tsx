import Link from "next/link";

/**
 * Trang 404 cua ca web: moi duong dan khong khop route nao, va moi lan mot trang goi notFound() (sach khong
 * co hoac khong phai cua nguoi nay, trang tra loi khong hop le...). Nam TRONG layout goc, nen dung dong theo
 * request nhu moi trang khac: co nonce cua CSP, co phong chu va mau cua web.
 *
 * Khong co AppNav: AppNav can nguoi dang dang nhap, tuc mot lan doc database, va trang 404 phai hien duoc ca
 * cho khach chua dang nhap lan luc database dang truc trac. Loi chu cung khong noi sach "khong ton tai" hay
 * "khong phai cua ban": notFound() tra cung mot trang cho ca hai truong hop, de nguoi ngoai khong do duoc
 * ma sach nao co that. "/" tu dinh tuyen ve dung cho (ke sach, dang nhap, khoi tao).
 */
export default function KhongThay() {
  return (
    <main className="shell shell--hep man">
      <div className="head">
        <div>
          <h1 className="d">Không thấy trang này</h1>
          <p className="head__sub">
            Đường dẫn này không mở ra trang nào. Có thể nó bị gõ nhầm, hoặc trang đó không còn ở đây nữa.
          </p>
        </div>
      </div>
      <div className="form__nut">
        <Link className="btn" href="/">Về trang chính</Link>
      </div>
    </main>
  );
}
