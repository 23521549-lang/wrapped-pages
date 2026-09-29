"use client";

import { useEffect, useState } from "react";
import { msTuCss } from "@/components/reader/Flipbook";

/** Chi dung khi token thieu hay sai don vi; nguon that la --dur-go (18ms) va --dur-nhay (1000ms) trong tokens.css. */
const GO_MAC_DINH = 18;
const NHAY_MAC_DINH = 1000;

function tokenMs(ten: string, macDinh: number): number {
  const ms = msTuCss(getComputedStyle(document.documentElement).getPropertyValue(ten));
  return Number.isFinite(ms) && ms > 0 ? ms : macDinh;
}

/**
 * Mot chuoi chu hien dan tung ky tu theo nhip go cua nghi thuc mo khoa (--dur-go), con tro .con-tro nhap nhay ngay sau
 * ky tu cuoi; go xong con tro nhay them mot chu ky --dur-nhay roi chi con chu thuong. Trinh doc man hinh doc ban day du
 * mot lan (chu an), phan dang go an voi no, nen khong bi doc tung chu. Noi goi quyet dinh co go hay khong (lan ve dau,
 * giam chuyen dong thi ve chu thuong, khong dung GoChu); doi chuoi thi noi goi dat key moi de go lai tu dau.
 */
export function GoChu({ chu }: { chu: string }) {
  const [n, setN] = useState(0);
  const [xong, setXong] = useState(false);

  useEffect(() => {
    const buoc = tokenMs("--dur-go", GO_MAC_DINH);
    let da = 0;
    let nhay: ReturnType<typeof setTimeout> | null = null;
    const go = setInterval(() => {
      da += 1;
      setN(da);
      if (da >= chu.length) {
        clearInterval(go);
        nhay = setTimeout(() => setXong(true), tokenMs("--dur-nhay", NHAY_MAC_DINH));
      }
    }, buoc);
    return () => {
      clearInterval(go);
      if (nhay !== null) clearTimeout(nhay);
    };
  }, [chu]);

  if (xong) return chu;
  return (
    <>
      <span className="sr-only">{chu}</span>
      <span aria-hidden="true">{chu.slice(0, n)}<span className="con-tro" /></span>
    </>
  );
}
