"use client";

import { useLayoutEffect, useState, type RefObject } from "react";

/** Be rong phan noi dung cua mot phan tu, khong tinh padding. */
function contentWidth(el: HTMLElement): number {
  const cs = getComputedStyle(el);
  return el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
}

/**
 * Ti le k de mot khoi rong logicalWidth px logic vua be rong noi dung cua ref, toi da max. Theo doi bang
 * ResizeObserver. Do phan noi dung (tru padding), vi khoi thu phong nam trong phan do: man viet dat ref
 * tren .viet-mat co padding ngang. Chua do duoc (luc render o may chu) thi tra 1.
 */
export function useFitScale(ref: RefObject<HTMLElement | null>, logicalWidth: number, max: number): number {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Do ngay truoc lan ve dau tien, de khong ve mot khung hinh voi k = 1.
    setWidth(contentWidth(el));
    const ro = new ResizeObserver((entries) => {
      setWidth(entries[entries.length - 1].contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return width > 0 ? Math.min(max, width / logicalWidth) : 1;
}
