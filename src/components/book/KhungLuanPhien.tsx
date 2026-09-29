"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTamDung } from "@/components/hieu-ung/tam-dung";
import { msTuCss } from "@/components/reader/Flipbook";
import { giamChuyenDong } from "@/components/tam-trang/hieu-ung-chung";
import { GoChu } from "./GoChu";
import { OpenBook, type OpenBookProps } from "./OpenBook";

/** Mot luot cua khung luan phien: dung cac prop cua OpenBook (may chu da loc), cong khoa rieng cua luot. */
export type LuotKhung = Omit<OpenBookProps, "tuDatNut" | "dem" | "chuPhai" | "dangDoi" | "nutLuanPhien" | "khungRef"> & {
  key: string;
};

/** Chi dung khi token thieu hay sai don vi; nguon that la --dur-luan-phien va --dur-doi-luot trong tokens.css. */
const LUAN_MAC_DINH = 15_000;
const DOI_MAC_DINH = 240;

function tokenMs(ten: string, macDinh: number): number {
  const ms = msTuCss(getComputedStyle(document.documentElement).getPropertyValue(ten));
  return Number.isFinite(ms) && ms > 0 ? ms : macDinh;
}

/**
 * Khung sach lon luan phien giua cac luot chua doc (spec 5a muc E3), ve dung markup cua OpenBook. Cu --dur-luan-phien
 * doi sang luot ke: hai trang mo di --dur-doi-luot (CSS .dang-doi), roi luot moi hien (ten, bia, nhan) va trang phai go
 * tung chu (GoChu). Lan ve dau hien du chu. Dung khi con tro hay focus o trong khung, khi tab an, va theo nut tam dung
 * chung (useTamDung, WCAG SC 2.2.2); het dieu kien dung thi dem lai du mot chu ky. Giam chuyen dong: van doi luot (co
 * nut tam dung rieng, xem nutLuanPhien) nhung doi ngay, khong mo, khong go. Vung khong aria-live: trinh doc man hinh
 * khong bi doc chen moi 15 giay.
 */
export function KhungLuanPhien({ luot, tuDatNut }: { luot: readonly LuotKhung[]; tuDatNut: boolean }) {
  const [i, setI] = useState(0);
  const [lanDau, setLanDau] = useState(true);
  const [dangDoi, setDangDoi] = useState(false);
  const [giu, setGiu] = useState(false);
  const [an, setAn] = useState(false);
  const [giam, setGiam] = useState(false);
  const [dung] = useTamDung();
  const doiRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const khungRef = useRef<HTMLElement>(null);

  // Con tro hay focus o trong khung thi dung (nghe tren chinh the article, khong gan trinh xu ly vao phan tu tinh).
  useEffect(() => {
    const el = khungRef.current;
    if (!el) return undefined;
    const vao = () => setGiu(true);
    const ra = () => setGiu(false);
    const roiFocus = (e: FocusEvent) => {
      if (!(e.relatedTarget instanceof Node && el.contains(e.relatedTarget))) setGiu(false);
    };
    el.addEventListener("pointerenter", vao);
    el.addEventListener("pointerleave", ra);
    el.addEventListener("focusin", vao);
    el.addEventListener("focusout", roiFocus);
    return () => {
      el.removeEventListener("pointerenter", vao);
      el.removeEventListener("pointerleave", ra);
      el.removeEventListener("focusin", vao);
      el.removeEventListener("focusout", roiFocus);
    };
  }, []);

  // Giam chuyen dong doc tren trinh duyet, khong doc luc render: may chu khong co matchMedia.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Dong bo voi he thong ngoai (matchMedia): may chu khong co matchMedia, doc luc render thi HTML may chu lech voi lan ve dau cua trinh duyet.
    setGiam(giamChuyenDong());
    const mq = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq === undefined) return undefined;
    const nghe = () => setGiam(mq.matches);
    mq.addEventListener("change", nghe);
    return () => mq.removeEventListener("change", nghe);
  }, []);

  // Tab an thi khong doi: nguoi dung khong nhin, quay lai khong duoc nhay qua mot loat luot.
  useEffect(() => {
    const nghe = () => setAn(document.visibilityState === "hidden");
    nghe();
    document.addEventListener("visibilitychange", nghe);
    return () => document.removeEventListener("visibilitychange", nghe);
  }, []);

  const sang = useCallback(() => {
    setI((x) => (x + 1) % luot.length);
    setLanDau(false);
    setDangDoi(false);
  }, [luot.length]);

  const chay = luot.length > 1 && !dung && !an && !giu && !dangDoi;
  useEffect(() => {
    if (!chay) return undefined;
    const hen = setTimeout(() => {
      if (giam) {
        sang();
        return;
      }
      setDangDoi(true);
      doiRef.current = setTimeout(() => {
        doiRef.current = null;
        sang();
      }, tokenMs("--dur-doi-luot", DOI_MAC_DINH));
    }, tokenMs("--dur-luan-phien", LUAN_MAC_DINH));
    return () => clearTimeout(hen);
  }, [chay, i, giam, sang]);

  // Go khung ra giua luc dang mo di thi bo lan doi do.
  useEffect(() => () => {
    if (doiRef.current !== null) clearTimeout(doiRef.current);
  }, []);

  const hien = luot[i % luot.length];
  const { key, ...mo } = hien;
  return (
    <OpenBook
      {...mo}
      tuDatNut={tuDatNut}
      dem={`Lượt chưa đọc ${(i % luot.length) + 1} / ${luot.length}`}
      chuPhai={!lanDau && !giam && hien.excerpt ? <GoChu key={key} chu={hien.excerpt} /> : undefined}
      dangDoi={dangDoi}
      nutLuanPhien={tuDatNut ? "luon" : "giam"}
      khungRef={khungRef}
    />
  );
}
