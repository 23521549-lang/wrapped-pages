/**
 * Dat `inert` len moi phan tu duoi `goc` TRU cac phan tu trong `giu`, to tien va con chau cua chung: phan con lai cua
 * trang khong bam, khong focus, khong doc duoc bang trinh doc man hinh. Tra ve ham go `inert` ra, chi go dung nhung phan
 * tu ham nay da dat (phan tu da inert tu truoc thi de nguyen).
 *
 * Trinh xem bia dung thay cho `<dialog>` mo kieu modal: modal dua hop thoai len lop tren cung cua trinh duyet, nen the
 * nhac (va khung YouTube trong no) se nam DUOI lop nen, trai luat "khong gi de len khung phat". Voi `inert`, the nhac
 * van noi tren lop nen va van dieu khien duoc, con moi thu khac bi khoa that.
 */
export function troNgoai(giu: readonly Element[], goc: Element = document.body): () => void {
  const da: Element[] = [];
  const di = (cha: Element) => {
    for (const con of Array.from(cha.children)) {
      if (giu.includes(con)) continue;
      if (giu.some((g) => con.contains(g))) {
        di(con);
        continue;
      }
      if (con.hasAttribute("inert") || con.tagName === "SCRIPT" || con.tagName === "STYLE" || con.tagName === "TEMPLATE") continue;
      con.setAttribute("inert", "");
      da.push(con);
    }
  };
  di(goc);
  return () => {
    for (const el of da) el.removeAttribute("inert");
  };
}
