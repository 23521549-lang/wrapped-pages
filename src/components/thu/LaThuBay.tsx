"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { actionThuChuaMo } from "@/app/actions/thu";
import { focusVeTrang } from "@/components/focus-ve-trang";
import { msTuCss } from "@/components/reader/Flipbook";
import { phanThang, tenThang } from "@/lib/tam-trang/lich";
import { chimMangToi, PHONG_SVG } from "./chim";
import { SU_KIEN_THU_DA_MO } from "./ChoThu";
import { HopThu } from "./HopThu";

/** Cac la thu da duoc chim mang toi tren trinh duyet nay: chim chi bay mot lan cho moi la. */
const KHOA_DA_TOI = "mqce-thu-da-toi";

function daToi(id: string): boolean {
  try {
    return (JSON.parse(localStorage.getItem(KHOA_DA_TOI) ?? "[]") as unknown[]).includes(id);
  } catch {
    return false;
  }
}

function ghiDaToi(id: string): void {
  try {
    const cu = (JSON.parse(localStorage.getItem(KHOA_DA_TOI) ?? "[]") as unknown[]).filter((x): x is string => typeof x === "string");
    localStorage.setItem(KHOA_DA_TOI, JSON.stringify([...cu.filter((x) => x !== id), id].slice(-24)));
  } catch {
    // Trinh duyet chan luu tru: chim bay lai o lan sau, khong sao.
  }
}

/** Hai khung chu nhat co giao nhau khong. */
const giao = (a: DOMRect, b: DOMRect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/**
 * La thu troi (spec 5b F2, F3): thu nguoi kia gui minh ma minh chua mo hien o goc tren ben phai (duoi thanh dieu huong) o
 * moi trang, toi khi duoc bam mo. Lan dau thay la do tren trinh duyet nay: chim mang thu bay toi tha xuong, trinh doc man
 * hinh nghe "{tên} vừa gửi thư tháng M cho bạn" mot lan. Thu toi luc dang mo trang: hoi lai moi 20 giay khi tab dang duoc
 * xem. Phong bi len xuong, lac, nghieng theo ba nhip lech nhau; re chuot hay focus thi dung. Khong bao gio de len khung
 * YouTube: dang de len mot khung phat thi tam an (cuon qua la hien lai). Bam la mo cua so doc thu.
 */
export function LaThuBay({ tenKia, tenMinh, dau }: { tenKia: string; tenMinh: string; dau: { id: string; thang: string } | null }) {
  const [thu, setThu] = useState(dau);
  /** La dang hien: la moi (chua toi tren trinh duyet nay) an cho toi khi chim tha xuong, ke ca o lan ve dau tu may chu. */
  const [daHien, setDaHien] = useState<string | null>(null);
  const [bao, setBao] = useState("");
  const [mo, setMo] = useState<string | null>(null);
  const [tranh, setTranh] = useState(false);
  const nutRef = useRef<HTMLButtonElement>(null);
  const troiRef = useRef<HTMLSpanElement>(null);

  // Hoi lai moi 20 giay khi tab dang duoc xem; tab an thi thoi, xem lai thi hoi ngay.
  const hoi = useEffectEvent(() => {
    if (document.visibilityState !== "visible" || mo !== null) return;
    void actionThuChuaMo().then((x) => {
      setThu((cu) => (cu?.id === x?.id ? cu : x));
    }, () => {});
  });
  useEffect(() => {
    const ms = msTuCss(getComputedStyle(document.documentElement).getPropertyValue("--dur-hoi-thu"));
    const hen = setInterval(hoi, Number.isFinite(ms) && ms > 0 ? ms : 20_000);
    const khiXem = () => {
      if (document.visibilityState === "visible") hoi();
    };
    document.addEventListener("visibilitychange", khiXem);
    return () => {
      clearInterval(hen);
      document.removeEventListener("visibilitychange", khiXem);
    };
  }, []);

  // Mot la vua mo o noi khac (Lich hoa, cua so doc thu): an ngay, khong cho lan hoi sau.
  useEffect(() => {
    const khiMo = (e: Event) => {
      const thang = (e as CustomEvent<string>).detail;
      setThu((cu) => (cu?.thang === thang ? null : cu));
    };
    addEventListener(SU_KIEN_THU_DA_MO, khiMo);
    return () => removeEventListener(SU_KIEN_THU_DA_MO, khiMo);
  }, []);

  // La moi toi: chim mang toi mot lan cho moi la tren trinh duyet nay.
  const toi = useEffectEvent(async (id: string, thang: string) => {
    const t = phanThang(thang);
    const loi = `${tenKia} vừa gửi thư ${t === null ? "tháng" : tenThang(t)} cho bạn.`;
    if (daToi(id)) {
      setDaHien(id);
      return;
    }
    ghiDaToi(id);
    try {
      if (troiRef.current) await chimMangToi(troiRef.current);
    } finally {
      setDaHien(id);
      setBao(loi);
      troiRef.current?.animate?.([{ transform: "translateY(-18px)", opacity: 0.6 }, { transform: "none", opacity: 1 }], {
        duration: 700, easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      });
    }
  });
  const id = thu?.id ?? null;
  const thangThu = thu?.thang ?? null;
  useEffect(() => {
    if (id === null || thangThu === null) return;
    // Khung hinh sau: nut vua ve xong, do duoc cho chim tha thu.
    const k = requestAnimationFrame(() => void toi(id, thangThu));
    return () => cancelAnimationFrame(k);
  }, [id, thangThu]);

  // La thu nam ngay duoi thanh dieu huong, bao nhieu hang cung vay: thanh xuong hai, ba hang o man hep (hay khi phong to
  // chu), nen do chieu cao that thay vi doan. Chua do duoc thi CSS dung token --nav-cao / --nav-cao-hep.
  useEffect(() => {
    const nav = document.querySelector<HTMLElement>("nav.nav");
    const nut = nutRef.current;
    if (id === null || !nav || !nut || typeof ResizeObserver === "undefined") return;
    const theoDoi = new ResizeObserver(() => nut.style.setProperty("--nav-that", `${nav.offsetHeight}px`));
    theoDoi.observe(nav);
    return () => theoDoi.disconnect();
  }, [id]);

  // Khong de len khung YouTube: dang giao voi mot iframe hay khung phat chung thi tam an.
  useEffect(() => {
    if (id === null) return;
    let khungHinh = 0;
    const xet = () => {
      khungHinh = 0;
      const nut = nutRef.current;
      if (!nut) return;
      const r = nut.getBoundingClientRect();
      const de = [...document.querySelectorAll("iframe, aside.mph:not([hidden])")].some((el) => el !== nut && giao(r, el.getBoundingClientRect()));
      setTranh(de);
    };
    const hen = () => {
      if (khungHinh === 0) khungHinh = requestAnimationFrame(xet);
    };
    hen();
    addEventListener("scroll", hen, { passive: true });
    addEventListener("resize", hen);
    const theoDoi = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(hen);
    theoDoi?.observe(document.body);
    return () => {
      cancelAnimationFrame(khungHinh);
      removeEventListener("scroll", hen);
      removeEventListener("resize", hen);
      theoDoi?.disconnect();
    };
  }, [id]);

  const t = thangThu === null ? null : phanThang(thangThu);
  const lop = ["thu-bay", daHien === id ? "" : "thu-bay--cho", tranh ? "thu-bay--tranh" : ""].filter(Boolean).join(" ");
  return (
    <>
      {/* Gradient giay cua moi phong bi (la thu troi, chim dua thu, cua so doc thu): khai mot lan o day. */}
      <svg className="sr-only" aria-hidden="true" focusable="false" width="0" height="0">
        <defs>
          <linearGradient id="giay-phong" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--color-giay)" />
            <stop offset="1" stopColor="var(--color-paper-2)" />
          </linearGradient>
        </defs>
      </svg>
      <p className="sr-only" aria-live="polite">{bao}</p>
      {thu !== null && t !== null && (
        <button
          ref={nutRef}
          type="button"
          className={lop}
          aria-label={`${tenKia} gửi bạn thư ${tenThang(t)}. Bấm để đọc`}
          onClick={() => setMo(thu.thang)}
        >
          <span className="thu-bay__bong" aria-hidden="true" />
          <span className="thu-bay__troi" ref={troiRef}>
            <span className="thu-bay__lac"><span className="thu-bay__lat" dangerouslySetInnerHTML={{ __html: PHONG_SVG }} /></span>
          </span>
          <span className="thu-bay__chu" aria-hidden="true">{`Thư từ ${tenKia}`}</span>
        </button>
      )}
      {mo !== null && (
        <HopThu
          thang={mo}
          tenKia={tenKia}
          tenMinh={tenMinh}
          dong={() => {
            setMo(null);
            // Thu da doc thi la thu troi da di: focus ve vung noi dung chinh thay vi roi ve body.
            if (nutRef.current) nutRef.current.focus();
            else focusVeTrang();
          }}
        />
      )}
    </>
  );
}
