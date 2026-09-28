/*
 * Hai dong thoi gian cua man Sua sach: moi luot dang (ke ca o mo dau luc tao sach) co the dat bia hay nhac rieng; luot
 * khong dat thi giu cai cua luot truoc. Ham thuan, cung luat voi newestCover va newestTrack o may chu: gia tri dang dung
 * la gia tri cua luot cuoi cung co dat.
 */

/** Gia tri hien hanh o moi luot: gia tri rieng neu co, khong thi cua luot gan nhat phia truoc (null truoc o dau tien). */
export function hienHanh<T>(os: readonly (T | null)[]): (T | null)[] {
  let truoc: T | null = null;
  return os.map((o) => {
    if (o !== null) truoc = o;
    return truoc;
  });
}

/** Chi so luot cuoi cung co gia tri rieng; -1 khi khong luot nao dat. */
export function cuoiCo<T>(os: readonly (T | null)[]): number {
  for (let i = os.length - 1; i >= 0; i--) if (os[i] !== null) return i;
  return -1;
}

/** Bai phat trong moi luot: ma video, hay null khi im (o go nhac, hay chua luot nao dat nhac). */
export function baiTheoLuot(os: readonly ({ youtubeId: string | null } | null)[]): (string | null)[] {
  return hienHanh(os).map((o) => o?.youtubeId ?? null);
}
