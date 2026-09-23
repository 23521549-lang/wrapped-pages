/**
 * Cong "Mo sach" cua man doc sach co nhac: hien tam bia khi nguoi xem chua tat nhac va loi vao khong co ?trang
 * hay ?mo. Loi vao toi mot trang cu the (?trang) hay qua nghi thuc mo khoa (?mo) thi mo thang sach, vi nghi thuc va
 * viec ghi to da xem khong chay sau tam bia. Chi can tham so co mat, ke ca gia tri rong hay lap lai.
 */
export function musicGate(muted: boolean, query: { trang?: unknown; mo?: unknown }): boolean {
  return !muted && query.trang === undefined && query.mo === undefined;
}
