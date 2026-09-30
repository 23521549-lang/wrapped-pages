/*
 * So nhac thang (dot nam 5b, spec B): luat bo trung bai va hang doi nhieu danh sach phat. Ham thuan, khong import react,
 * next hay drizzle.
 */

/**
 * Bo trung bai: xep theo luc dat (som truoc; bang nhau giu thu tu dau vao), cung mot ma YouTube chi giu lan dat dau tien.
 */
export function boTrung<T extends { youtubeId: string; at: Date }>(ds: readonly T[]): T[] {
  const da = new Set<string>();
  return ds
    .map((b, i) => ({ b, i }))
    // oxlint-disable-next-line unicorn/no-array-sort -- mang vua tao; toSorted can lib ES2023, du an dang o ES2022.
    .sort((x, y) => x.b.at.getTime() - y.b.at.getTime() || x.i - y.i)
    .flatMap(({ b }) => {
      if (da.has(b.youtubeId)) return [];
      da.add(b.youtubeId);
      return [b];
    });
}

/** Vi tri trong hang doi: danh sach thu ds, bai thu bai (tu 0). */
export type ViTri = { ds: number; bai: number };

/** Bai dau cua danh sach ds; danh sach rong hay khong co thi null. */
export function baiDau(dsBai: readonly (readonly unknown[])[], ds: number): ViTri | null {
  return (dsBai[ds]?.length ?? 0) > 0 ? { ds, bai: 0 } : null;
}

/**
 * Bai ke tiep sau vt, khi dang phat tu danh sach batDau: con bai trong danh sach thi bai ke; het thi sang danh sach ke
 * (bo danh sach rong), vong lai tu dau; toi lai danh sach batDau la da phat het moi danh sach, dung (null).
 */
export function baiKeTiep(dsBai: readonly (readonly unknown[])[], vt: ViTri, batDau: number): ViTri | null {
  if (vt.bai + 1 < dsBai[vt.ds].length) return { ds: vt.ds, bai: vt.bai + 1 };
  for (let ds = (vt.ds + 1) % dsBai.length; ds !== batDau; ds = (ds + 1) % dsBai.length) {
    const dau = baiDau(dsBai, ds);
    if (dau !== null) return dau;
  }
  return null;
}
