"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { actionSeenActivity } from "@/app/actions/feed";
import { msTuCss } from "@/components/reader/Flipbook";

/** Chi dung khi token thieu hay sai don vi; nguon that la --dur-moi-xem (1000ms) va --dur-moi-tan (3000ms) trong tokens.css. */
const XEM_MAC_DINH = 1000;
const TAN_MAC_DINH = 3000;
/** Gom cac dong vua xem trong chung nay roi gui mot lan. */
const GOM_MS = 800;
/**
 * It nhat mot nua dong nam trong khung nhin. isIntersecting van dung khi chi lo mot mep, nen phai xet ti le; trinh duyet
 * bao ti le ngay nguong co the lech mot chut duoi 0,5 nen chua mot khoang nho.
 */
const NUA = 0.5;
const SAI_SO = 0.01;

const hien = () => document.visibilityState === "visible";

/**
 * Vung cuon cua khung Hoat dong (an thanh cuon nen nhan focus de cuon bang phim), kiem luon viec "da xem" cua dau Moi
 * (spec 5a muc D). Dong Moi la li[data-moi][data-id]. Tinh da xem khi: dong nam trong khung nhin it nhat mot nua lien
 * tuc --dur-moi-xem (khung nhin la cua so: vung cuon cat san phan khuat, nen khung Hoat dong nam duoi man hinh dien
 * thoai chua cuon toi thi chua tinh), hay khi con tro, focus vao dong. Tab an thi khong tinh, hien lai thi quan sat lai.
 * Da xem thi dong mang lop da-xem ngay (CSS cho dau tan tai cho, khong xe dich) va data-tan (luc tan xong, de TuCapNhat
 * khong lam moi giua chung), id gom lai gui mot lan sau GOM_MS;
 * gui loi thi bo qua (lan mo sau dong van Moi, xem lai la xong). moi la chuoi id cac dong Moi: danh sach doi (trang ve
 * lai) thi quan sat lai tu dau.
 */
export function TheoDoiXem({ moi, children }: { moi: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const vung = ref.current;
    if (!vung || moi === "") return undefined;
    const dong = [...vung.querySelectorAll<HTMLElement>("li[data-moi][data-id]")].filter((li) => !li.classList.contains("da-xem"));
    if (dong.length === 0) return undefined;
    const token = (ten: string, macDinh: number) => {
      const ms = msTuCss(getComputedStyle(document.documentElement).getPropertyValue(ten));
      return Number.isFinite(ms) && ms > 0 ? ms : macDinh;
    };
    const giu = token("--dur-moi-xem", XEM_MAC_DINH);
    const tan = token("--dur-moi-tan", TAN_MAC_DINH);

    const cho = new Set<string>();
    let hen: ReturnType<typeof setTimeout> | null = null;
    const gui = () => {
      hen = null;
      const ids = [...cho];
      cho.clear();
      if (ids.length > 0) actionSeenActivity(ids).catch(() => undefined);
    };
    const dem = new Map<Element, ReturnType<typeof setTimeout>>();
    const thoiDem = (li: Element) => {
      clearTimeout(dem.get(li));
      dem.delete(li);
    };

    let quan: IntersectionObserver | null = null;
    const xem = (li: HTMLElement) => {
      if (li.classList.contains("da-xem")) return;
      li.classList.add("da-xem");
      // Luc dau tan xong: TuCapNhat khong lam moi truoc luc nay, de dau khong bien mat giua chung.
      li.dataset.tan = String(Date.now() + tan);
      thoiDem(li);
      quan?.unobserve(li);
      if (li.dataset.id) cho.add(li.dataset.id);
      hen ??= setTimeout(gui, GOM_MS);
    };

    if (typeof IntersectionObserver !== "undefined") {
      quan = new IntersectionObserver((ds) => {
        for (const d of ds) {
          const li = d.target as HTMLElement;
          if (!d.isIntersecting || d.intersectionRatio < NUA - SAI_SO) {
            thoiDem(li);
          } else if (!dem.has(li)) {
            dem.set(li, setTimeout(() => {
              dem.delete(li);
              if (hien()) xem(li);
            }, giu));
          }
        }
      }, { threshold: [0, NUA] });
      for (const li of dong) quan.observe(li);
    }

    const khiVao = (e: Event) => {
      const li = e.target instanceof Element ? e.target.closest<HTMLElement>("li[data-moi][data-id]") : null;
      if (li && vung.contains(li)) xem(li);
    };
    // Quan sat lai de trinh duyet bao lai trang thai hien tai: tab an luc dem thi dem do khong tinh.
    const khiHien = () => {
      if (!hien() || !quan) return;
      for (const li of dong) {
        if (li.classList.contains("da-xem")) continue;
        quan.unobserve(li);
        quan.observe(li);
      }
    };
    vung.addEventListener("pointerover", khiVao);
    vung.addEventListener("focusin", khiVao);
    document.addEventListener("visibilitychange", khiHien);
    return () => {
      quan?.disconnect();
      for (const t of dem.values()) clearTimeout(t);
      vung.removeEventListener("pointerover", khiVao);
      vung.removeEventListener("focusin", khiVao);
      document.removeEventListener("visibilitychange", khiHien);
      if (hen !== null) {
        clearTimeout(hen);
        gui();
      }
    };
  }, [moi]);

  return (
    // section co nhan la vai tro region. Thanh cuon an nen vung phai nhan focus de cuon bang phim.
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- vung cuon an thanh cuon, khong co cach cuon bang phim nao khac
    <section ref={ref} className="hoat-dong__cuon" tabIndex={0} aria-label="Hoạt động gần đây">
      {children}
    </section>
  );
}
