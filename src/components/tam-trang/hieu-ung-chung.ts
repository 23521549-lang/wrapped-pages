/*
 * Do dung chung cua hai hieu ung bau troi: vong song nuoc khi DOI CHO hai bau troi (song.ts) va vet loang khi THAY
 * mot tam trang (loang.ts). Hai hieu ung khac viec nen hinh cua chung khong dung chung duoc, nhung so sach thi dung
 * chung: cung mot dai troi, cung mot yeu cau "roi trang giua chung thi khong duoc bo quen mot hen gio hay mot
 * hoat hinh nao".
 */

/** Moi viec dang cho cua mot dai troi, de huy sach khi thanh phan roi trang giua luc hieu ung dang chay. */
export type Viec = {
  hen: Set<ReturnType<typeof setTimeout>>;
  khung: Set<number>;
  ranh: Set<number>;
  hoat: Animation[];
};

const viecCua = new WeakMap<HTMLElement, Viec>();

export function viec(w: HTMLElement): Viec {
  const co = viecCua.get(w);
  if (co !== undefined) return co;
  const moi: Viec = { hen: new Set(), khung: new Set(), ranh: new Set(), hoat: [] };
  viecCua.set(w, moi);
  return moi;
}

/** setTimeout co ghi so, de ham go cua dai troi huy duoc. */
export function hen(w: HTMLElement, f: () => void, ms: number): void {
  const v = viec(w);
  const id = setTimeout(() => {
    v.hen.delete(id);
    f();
  }, ms);
  v.hen.add(id);
}

/**
 * Ghi lai mot hoat hinh de huy duoc khi roi trang giua chung: vao so chung cua dai troi (ham go huy sach) VA vao so
 * rieng `cua` cua vong hieu ung dang chay, de chinh vong do don minh khi tan.
 *
 * Vi sao phai co so rieng: moi vong ghi hang chuc (vong song) toi hang tram (lan loang) doi tuong Animation, va moi
 * cai giu mot KeyframeEffect tro toi phan tu cua no - ke ca phan tu da bi go khoi cay DOM. Chi co so chung thi mang
 * ay chi duoc vut di luc roi trang, tuc bam qua lai 30 lan la giu song song hang nghin Animation suot ca lan tham
 * trang. `hen`, `khung` va `ranh` deu tu xoa minh khi chay xong; `hoat` gio cung vay.
 */
export function ghi(w: HTMLElement, cua: Set<Animation>, a: Animation | undefined): void {
  if (a === undefined) return;
  viec(w).hoat.push(a);
  cua.add(a);
}

/*
 * Khoa dung chung cua mot dai troi: ten hieu ung dang chiem no.
 *
 * Hai hieu ung ve len CUNG mot dai va ghi vao CUNG mot so hoat hinh, nen chung khong duoc chay chong nhau. Vong song
 * mo dau bang viec huy sach so hoat hinh dang cho, tuc no dong bang may chuc vet nuoc cua mot lan loang dang do;
 * nguoc lai, trong lan loang o cua so co HAI o kinh xep chong nen mot vong song bat dau giua chung se doc nham o kinh
 * sap bi go (phat hien N1).
 *
 * MOT khoa cho ca hai chu khong phai moi ben mot co rieng: hai co rieng thi ben nao cung chi thay minh dang chay, ma
 * do dung la tinh huong hong. Khoa ghi TEN chu dang giu chu khong chi ghi "co ai do", de mot lan loang moi van thay
 * the duoc lan loang cu - nguoi dung thay tam trang hai lan lien la viec binh thuong - trong khi mot vong song thi
 * khong.
 */
export const SONG = "song";
export const LOANG = "loang";

const chuCua = new WeakMap<HTMLElement, string>();

/** Ten hieu ung dang giu dai troi, undefined khi dai dang ranh. */
export function chuDai(w: HTMLElement): string | undefined {
  return chuCua.get(w);
}

export function giuDai(w: HTMLElement, ten: string): void {
  chuCua.set(w, ten);
}

/** Nha dai troi, nhung chi khi no van con la cua `ten`: cai hen don dep cua mot hieu ung da tan khong duoc nha ho. */
export function nhaDai(w: HTMLElement, ten: string): void {
  if (chuCua.get(w) === ten) chuCua.delete(w);
}

/** Huy sach moi viec dang cho cua mot dai troi va xoa so. Goi khi thanh phan roi trang. */
export function goViec(w: HTMLElement): void {
  // Nha ca khoa: da huy sach hen gio va hoat hinh thi khong con hieu ung nao dang chay tren dai nay nua.
  chuCua.delete(w);
  const v = viecCua.get(w);
  if (v === undefined) return;
  for (const id of v.hen) clearTimeout(id);
  for (const id of v.khung) cancelAnimationFrame(id);
  for (const id of v.ranh) globalThis.cancelIdleCallback?.(id);
  for (const a of v.hoat) a.cancel();
  viecCua.delete(w);
}

/**
 * So hoat hinh ma mot dai troi dang giu. Chi de bai kiem do duoc ro ri: mang nay phai xep lai sau moi vong hieu ung,
 * khong duoc lon dan theo so lan doi cho hay so lan thay tam trang (xem tests/unit/tam-trang-bau-troi.test.tsx).
 */
export function soHoatDangGiu(w: HTMLElement): number {
  return viecCua.get(w)?.hoat.length ?? 0;
}

export const giamChuyenDong = (): boolean =>
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

/**
 * Cac dong chu cua mot bau troi, theo dung thu tu tren duoi. Ca hai hieu ung dung chung ham nay: song.ts do khoang
 * cach tu tam song toi tung dong roi hien chu theo mep song, loang.ts lam chuyen do cho ca chu cu lan chu moi.
 *
 * Luon goi voi mot the `.troi` (mot bau troi), khong phai ca dai troi: khuon giu cho chieu cao cung co mot `.troi__noi`
 * cua rieng no, ma khuon thi khong duoc chay hoat hinh nao.
 */
export function dongChu(sec: ParentNode): HTMLElement[] {
  return [...sec.querySelectorAll<HTMLElement>(".troi__noi > *")];
}
