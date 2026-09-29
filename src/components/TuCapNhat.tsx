"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { actionPhienBanKe } from "@/app/actions/feed";
import { msTuCss } from "@/components/reader/Flipbook";

/** Chi dung khi token thieu hay sai don vi; nguon that la --dur-tu-cap-nhat (15000ms) trong tokens.css. */
const CHU_KY_MAC_DINH = 15_000;

/**
 * Trang dang ban voi nguoi dung, lam moi luc nay la cat ngang viec ho dang lam (spec 5a muc G2): dang go (focus o o
 * nhap), co hop dang mo (aria-expanded, vd hop Tha tam trang), mot action dang chay (aria-busy), hay dau Moi con dang
 * tan (TheoDoiXem dat data-tan la luc tan xong: lam moi giua chung se lam dau bien mat giua chung).
 */
function dangBan(): boolean {
  const o = document.activeElement;
  if (o instanceof HTMLElement && (o.isContentEditable || o.matches("input, textarea, select"))) return true;
  if (document.querySelector('[aria-expanded="true"], [aria-busy="true"]')) return true;
  const bay = Date.now();
  return [...document.querySelectorAll<HTMLElement>("[data-tan]")].some((e) => Number(e.dataset.tan) > bay);
}

/**
 * Ke sach tu cap nhat (spec 5a muc G1): khi tab dang duoc xem, cu --dur-tu-cap-nhat hoi phien ban cua ke
 * (actionPhienBanKe, mot chuoi re); khac phien ban luc trang ve thi router.refresh(). Tab vua hien lai thi hoi ngay.
 * Trang dang ban thi bo qua lan nay, lan sau hoi lai. Hoi loi (mat mang) thi im lang. Khong ve gi.
 */
export function TuCapNhat({ phienBan }: { phienBan: string }) {
  const router = useRouter();
  const moc = useRef(phienBan);

  // Trang ve lai (tu lan lam moi nay hay mot action) mang phien ban moi: lay do lam moc so sanh.
  useEffect(() => {
    moc.current = phienBan;
  }, [phienBan]);

  useEffect(() => {
    const ms = msTuCss(getComputedStyle(document.documentElement).getPropertyValue("--dur-tu-cap-nhat"));
    const chuKy = Number.isFinite(ms) && ms > 0 ? ms : CHU_KY_MAC_DINH;
    let dangHoi = false;
    let thoi = false;
    const hoi = async () => {
      if (dangHoi || document.visibilityState !== "visible" || dangBan()) return;
      dangHoi = true;
      try {
        const moi = await actionPhienBanKe();
        // Hoi xong moi xet lai: trong luc cho, nguoi dung co the vua bat dau go hay mo hop.
        if (!thoi && typeof moi === "string" && moi !== moc.current && !dangBan()) {
          moc.current = moi;
          router.refresh();
        }
      } catch {
        // Mat mang: lan sau hoi lai.
      } finally {
        dangHoi = false;
      }
    };
    const hen = setInterval(() => void hoi(), chuKy);
    const khiHien = () => {
      if (document.visibilityState === "visible") void hoi();
    };
    document.addEventListener("visibilitychange", khiHien);
    return () => {
      thoi = true;
      clearInterval(hen);
      document.removeEventListener("visibilitychange", khiHien);
    };
  }, [router]);

  return null;
}
