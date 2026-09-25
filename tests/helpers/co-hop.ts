import { afterEach, beforeEach, expect } from "vitest";

/*
 * Co hop gia cho jsdom, dung chung cho MOI bai kiem co chay `loangTroi`.
 *
 * jsdom tra ve 0 cho moi clientWidth/clientHeight, ma `loangTroi` bo qua han lan loang khi be rong hay chieu cao bang
 * 0 (may qua cu, khung chua do xong). Bai kiem nao quen va hai so nay se do Y HET NHAU truoc va sau khi code duoc
 * viet: no khong chung minh duoc gi ca. Du an da ba lan dinh dung cai bay do, nen cho va nam o dung mot noi, tu tra
 * lai sau moi bai, va moi tep goi chung ham nay thay vi moi tep chep mot ban.
 */

const TEN = ["clientWidth", "clientHeight"] as const;
type TenHop = (typeof TEN)[number];

const goc = new Map<TenHop, PropertyDescriptor | undefined>();

/**
 * Va co hop cho ca tep kiem: moi HTMLElement trong jsdom nhan be rong W va chieu cao H. Goi o muc tep (ngoai `it`),
 * ham tu gan beforeEach/afterEach cua no. Tra lai nguyen trang sau moi bai, de khong de ban va moi truong dung chung
 * cho cac tep chay sau (vitest dat fileParallelism: false).
 */
export function dungCoHop(W: number, H: number): void {
  beforeEach(() => {
    for (const [ten, so] of [["clientWidth", W], ["clientHeight", H]] as const) {
      goc.set(ten, Object.getOwnPropertyDescriptor(HTMLElement.prototype, ten));
      Object.defineProperty(HTMLElement.prototype, ten, { value: so, configurable: true });
    }
  });
  afterEach(() => {
    for (const ten of TEN) {
      const mo = goc.get(ten);
      if (mo === undefined) delete (HTMLElement.prototype as Partial<HTMLElement>)[ten];
      else Object.defineProperty(HTMLElement.prototype, ten, mo);
    }
    goc.clear();
  });
}

/**
 * Lop vet nuoc cua mot lan loang, kem mot khang dinh no CO that. Moi bai chay `loangTroi` deu phai di qua day truoc
 * khi kiem thu gi khac: neu cua chan be rong bang 0 nuot mat lan loang thi bai phai do o dung dong nay, chu khong
 * phai xanh im lang roi khang dinh nhung thu rong tuech.
 */
export function lopLoang(trong: ParentNode): HTMLElement {
  const lop = trong.querySelector<HTMLElement>(".loang");
  expect(lop, "khong co lop loang: lan loang da bi bo qua (co hop bang 0?) nen moi khang dinh sau day deu vo nghia").not.toBeNull();
  return lop as HTMLElement;
}
