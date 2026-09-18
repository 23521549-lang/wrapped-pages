"use client";

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";

/** Cham 0 ma component van con (may chu chua thay mo, vd lech vai tram mili giay) thi goi lai sau chung nay. */
export const THU_LAI_MS = 2000;

/**
 * Lech dong ho (gio may chu tru Date.now()) do MOT lan cho ca man doc. Khung thu thach bi go ra khi lat khoi
 * to niem phong va gan lai khi lat ve; neu moi lan gan lai deu do voi now cu cua trang thi thoi gian nguoi
 * doc da o tren trang bi tinh thanh lech va dong ho chay tre. Reader cung cap gia tri nay cho moi khung.
 */
export const ClockSkew = createContext<RefObject<number | null> | null>(null);

/**
 * Do lech mot lan cho moi lan gan noi goi, voi now cua lan ve dau. Cac now moi sau do (router.refresh) khong
 * do lai: do lai o day se bo qua THU_LAI_MS va tinh ca thoi gian cho phan hoi vao lech.
 */
export function useClockSkew(now: Date): RefObject<number | null> {
  const lech = useRef<number | null>(null);
  const serverNow = now.getTime();
  useLayoutEffect(() => {
    if (lech.current === null) lech.current = serverNow - Date.now();
  }, [serverNow]);
  return lech;
}

/**
 * So mili giay con lai toi target, dem theo dong ho MAY CHU uoc luong, nen dong ho may nguoi doc nhanh hay
 * cham khong lam ve 0 som. Lech lay tu ClockSkew neu co (Reader), khong thi do luc gan. Lan ve dau dung
 * chinh now nen khop voi ban ve o may chu. Cham 0 thi goi onZero, roi goi lai moi THU_LAI_MS neu component
 * van con. target null thi tra 0 va khong hen gio nao.
 */
export function useTimeLeft(target: Date | null, now: Date, onZero: () => void): number {
  const t = target === null ? null : target.getTime();
  const serverNow = now.getTime();
  const [left, setLeft] = useState(() => (t === null ? 0 : Math.max(0, t - serverNow)));
  const rieng = useClockSkew(now);
  const lech = useContext(ClockSkew) ?? rieng;
  const zero = useRef(onZero);

  useLayoutEffect(() => {
    zero.current = onZero;
  });

  useEffect(() => {
    if (t === null) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      // Doc lech luc chay: setTimeout chay sau moi layout effect, ke ca cua Reader (chay sau cac con).
      const con = Math.max(0, t - (Date.now() + (lech.current ?? 0)));
      setLeft(con);
      if (con === 0) {
        zero.current();
        timer = setTimeout(tick, THU_LAI_MS);
        return;
      }
      timer = setTimeout(tick, con % 1000 || 1000);
    };
    timer = setTimeout(tick, 0);
    return () => clearTimeout(timer);
  }, [t, lech]);

  return t === null ? 0 : left;
}
