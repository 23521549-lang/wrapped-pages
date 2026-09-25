"use client";

import { useCallback, useLayoutEffect, useState } from "react";

/*
 * MOT lua chon "tam dung hieu ung" duy nhat cho ca web. Hom nay no dung net ve cua bau troi o dau ke sach; plan sau
 * dung them bia tu doi cua khung sach lon, va chi can goi useTamDung chu KHONG duoc viet duong doc thu hai. WCAG SC
 * 2.2.2 doi moi noi dung tu chuyen dong keo dai qua 5 giay va nam song song voi noi dung khac deu phai dung duoc, ma
 * hai thu ay o cung mot trang, nen chung phai nghe cung mot cong tac - hai nut rieng thi nguoi dung bam mot cai van
 * con cai kia chay (phan quyet B4).
 *
 * Day chi la lua chon trinh bay nen de o trinh duyet, khong len may chu. Trinh duyet co the cam ca viec DOC lan viec
 * GHI localStorage (che do rieng tu, chan luu tru), nen moi lan cham deu boc trong try/catch: cong tac van chay, chi
 * khong nho duoc lua chon sang lan sau.
 */

/** Giu nguyen ten khoa cua dot truoc: nguoi da chon tam dung tu truoc khong duoc mat lua chon vi mot lan doi ten. */
export const KHOA_DUNG = "troi-tam-dung";

/** Su kien noi bo, de moi noi dang nghe cung doi trong dung mot lan bam chu khong doi o lan tham trang sau. */
const SU_KIEN = "hieu-ung-tam-dung";

/** Da chon tam dung tu lan truoc chua. */
export function docDaDung(): boolean {
  try {
    return localStorage.getItem(KHOA_DUNG) === "dung";
  } catch {
    return false;
  }
}

/**
 * Tra ve [dang dung, dat lua chon].
 *
 * `khiDoi` (phai la mot ham on dinh, vi du useCallback voi mang phu thuoc rong) chay DONG BO moi lan gia tri doi, ke
 * ca lan doc lua chon da luu luc vao cay va ke ca o chinh noi vua bam. Do la cho danh cho viec cham thang vao DOM,
 * vi du bat lop `troi-dung` tren dai troi: lop moi la thu quyet dinh hieu ung co chay hay khong, va no khong di qua
 * React nen dat duoc som nhat co the. Doi toi vong ve lai cua setState la nguoi da tat hieu ung van thay dung mot
 * khung hinh hieu ung CHAY.
 *
 * Doc lua chon da luu trong mot LAYOUT effect chu khong phai passive effect: passive effect chi chay sau khi trinh
 * duyet ve xong, nen do cung la mot nhap nhay ngay tren chinh thu ho da tat. Cung khong doc duoc luc render: may chu
 * khong co localStorage, doc luc render la HTML may chu gui xuong lech voi lan ve dau cua trinh duyet.
 *
 * `datDung` khong tu goi setState: no ghi lua chon roi phat su kien, va CHINH no cung dang nghe su kien do. Nho vay
 * moi noi nghe - ke ca noi vua bam - di qua dung mot duong, va `khiDoi` khong bao gio bi bo sot o noi khoi xuong.
 */
export function useTamDung(khiDoi?: (v: boolean) => void): [boolean, (v: boolean) => void] {
  const [dung, setDung] = useState(false);

  useLayoutEffect(() => {
    if (docDaDung()) {
      khiDoi?.(true);
      // oxlint-disable-next-line react/set-state-in-effect -- Dung dung viec ma chinh luat nay cho phep: dong bo voi mot he thong ngoai (localStorage). Khong "khoi tao thang trang thai" duoc, vi may chu khong co localStorage nen doc luc render la HTML may chu gui xuong lech voi lan ve dau cua trinh duyet; cung khong "cap nhat tu su kien gay ra thay doi" duoc, vi thay doi nay den tu mot phien truoc chu khong tu su kien nao trong phien nay.
      setDung(true);
    }
    const nghe = (e: Event) => {
      const v = (e as CustomEvent<boolean>).detail;
      khiDoi?.(v);
      setDung(v);
    };
    globalThis.addEventListener(SU_KIEN, nghe);
    return () => globalThis.removeEventListener(SU_KIEN, nghe);
  }, [khiDoi]);

  const datDung = useCallback((v: boolean) => {
    try {
      localStorage.setItem(KHOA_DUNG, v ? "dung" : "chay");
    } catch {
      // Trinh duyet chan luu tru: cong tac van chay, chi khong nho duoc lua chon sang lan sau.
    }
    globalThis.dispatchEvent(new CustomEvent(SU_KIEN, { detail: v }));
  }, []);

  return [dung, datDung];
}
