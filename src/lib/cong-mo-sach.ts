/**
 * Cong "Mo sach" cua man doc: hien tam bia khi loi vao khong co ?trang hay ?mo, voi MOI cuon, co nhac hay khong (chu du
 * an chot 26/09). Loi vao toi mot trang cu the (?trang, vd bam khung sach lon hay "Đọc từ trang N") hay qua nghi thuc
 * mo khoa (?mo) thi mo thang sach, vi nghi thuc va viec ghi to da xem khong chay sau tam bia. Chi can tham so co mat, ke
 * ca gia tri rong hay lap lai. Lua chon tat nhac khong con bo qua tam bia: tam bia la nghi thuc mo sach, khong chi la
 * cu bam cho phep phat tieng.
 */
export function congMoSach(query: { trang?: unknown; mo?: unknown }): boolean {
  return query.trang === undefined && query.mo === undefined;
}
