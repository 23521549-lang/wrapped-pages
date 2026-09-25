/*
 * Tui xao: rut ngau nhien nhung di het danh sach roi moi lap lai. Rut doc lap moi lan thi co luc cung mot phan tu
 * hien hai lan lien va nguoi dung thay nhu hong; tui xao bo han truong hop do.
 */

/**
 * Tra ve mot ham rut. Moi vong la mot lan xao Fisher-Yates roi di het tui theo thu tu do. Het tui thi xao lai, va neu
 * phan tu dau tui moi trung phan tu vua rut cuoi cung thi doi cho no voi mot phan tu khac trong tui - nho vay hai lan
 * rut lien nhau khong bao gio trung, ke ca ngay ranh gioi hai vong.
 * `ngauNhien` tra mot so trong [0, 1); tach ra thanh tham so de bai kiem chay duoc tat dinh.
 * Danh sach rong nem loi: khong co gi de rut, va tra undefined lang le se de lot mot o trong xuong toi giao dien.
 */
export function taoTuiXao<T>(items: readonly T[], ngauNhien: () => number = Math.random): () => T {
  if (items.length === 0) throw new Error("tui xao can it nhat mot phan tu");
  let tui: T[] = [];
  let vuaRut: T | undefined;

  function xaoLai(): void {
    tui = [...items];
    for (let i = tui.length - 1; i > 0; i--) {
      const j = Math.floor(ngauNhien() * (i + 1));
      [tui[i], tui[j]] = [tui[j], tui[i]];
    }
    // Tui di tu cuoi mang ve dau (pop), nen phan tu duoc rut dau tien cua vong moi la phan tu cuoi mang.
    if (tui.length > 1 && tui[tui.length - 1] === vuaRut) {
      [tui[tui.length - 1], tui[0]] = [tui[0], tui[tui.length - 1]];
    }
  }

  return () => {
    if (tui.length === 0) xaoLai();
    const ra = tui.pop() as T;
    vuaRut = ra;
    return ra;
  };
}
