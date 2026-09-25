"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { DocView } from "@/components/doc/DocView";
import { GIAM_CHUYEN_DONG, msTuCss } from "@/components/reader/Flipbook";
import { VUNG_SACH } from "@/components/reader/MoSach";
import { docCharCount } from "@/lib/doc/text";
import type { DocJson } from "@/lib/doc/types";

/** Chi dung khi token thieu hoac sai don vi; nguon that la --dur-go (18ms) va --dur-nhay (1000ms) trong tokens.css. */
const GO_MAC_DINH = 18;
const NHAY_MAC_DINH = 1000;

/** Vung sach cua Flipbook: nhan focus khi nghi thuc xong. */

/** Doc mot token thoi gian. Ban build viet lai "18ms" thanh ".018s", nen phai qua msTuCss, khong parseFloat. */
function tokenMs(ten: string, macDinh: number): number {
  const ms = msTuCss(getComputedStyle(document.documentElement).getPropertyValue(ten));
  return Number.isFinite(ms) && ms > 0 ? ms : macDinh;
}

function theoDoiGiam(bao: () => void): () => void {
  const mq = window.matchMedia(GIAM_CHUYEN_DONG);
  mq.addEventListener("change", bao);
  return () => mq.removeEventListener("change", bao);
}
const giamTrenTrinhDuyet = () => window.matchMedia(GIAM_CHUYEN_DONG).matches;
const giamTrenMayChu = () => false;

/**
 * Nghi thuc mo: chu hien dan theo nhip --dur-go, con tro nhap nhay ngay sau ky tu cuoi. Ca trang
 * da nam san trong DOM, phan chua go chi bi an tai cho (DocView typing), nen chu khong nhay dong va trinh doc
 * man hinh doc duoc ca trang; vung chu mang aria-busy khi dang go. Go het thi con tro nhap nhay them mot chu ky
 * --dur-nhay. Bam phim hay bam chuot o bat cu dau thi hien het ngay. Giam chuyen dong thi hien thang, khong go,
 * khong con tro. Khong co tieng. Khi xong (du bang cach nao): dua focus vao vung sach neu focus dang roi o body,
 * roi goi onDone dung mot lan. Khoi media tinh 0 ky tu va khong go: giu dung cho nhung an toi khi chu dung truoc no go
 * xong, roi hien ngay; giam chuyen dong thi hien cung chu; ghi am khong tu phat. To chi co media thi xong ngay.
 */
export function TypeReveal({ doc, author, onDone }: { doc: DocJson; author: string; onDone?: () => void }) {
  const total = docCharCount(doc);
  const giam = useSyncExternalStore(theoDoiGiam, giamTrenTrinhDuyet, giamTrenMayChu);
  const [n, setN] = useState(0);
  const [ket, setKet] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  const daBao = useRef(false);
  // xong: hien thang, khong con tro. goXong: da go het, con tro con nhap nhay not mot chu ky.
  const xong = giam || ket || total === 0;
  const goXong = n >= total;

  useLayoutEffect(() => {
    doneRef.current = onDone;
  });

  const bao = useCallback(() => {
    if (daBao.current) return;
    daBao.current = true;
    // Redirect sau khi mo lam roi focus (o tra loi vua bien mat); chi dua ve vung sach khi focus dang o body.
    const dang = document.activeElement;
    if (dang === null || dang === document.body) {
      ref.current?.closest<HTMLElement>(VUNG_SACH)?.focus({ preventScroll: true });
    }
    doneRef.current?.();
  }, []);

  // Go: moi nhip tinh so ky tu tu thoi gian da troi, nen trinh duyet bi cham nhip cung khong go cham theo.
  useEffect(() => {
    if (xong) return;
    const go = tokenMs("--dur-go", GO_MAC_DINH);
    const batDau = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    const buoc = () => {
      const k = Math.min(total, Math.floor((Date.now() - batDau) / go));
      setN(k);
      if (k < total) timer = setTimeout(buoc, go);
    };
    timer = setTimeout(buoc, go);
    return () => clearTimeout(timer);
  }, [xong, total]);

  // Go het: con tro nhap nhay them mot chu ky --dur-nhay, roi moi xong. Hen gio don trong cung hieu ung.
  useEffect(() => {
    if (xong || !goXong) return;
    const hen = setTimeout(() => {
      setKet(true);
      bao();
    }, tokenMs("--dur-nhay", NHAY_MAC_DINH));
    return () => clearTimeout(hen);
  }, [xong, goXong, bao]);

  // Bam phim hay bam chuot thi hien het. Goi bao() ngay trong trinh nghe: phim mui ten vua bo qua nghi thuc vua
  // lat trang thi man doc thoi ve TypeReveal trong cung lan cap nhat voi cu lat. Dang ky sau mot nhip de chinh
  // cu bam vua dua nguoi doc toi day khong tu bo qua nghi thuc.
  useEffect(() => {
    if (xong) return;
    const hienHet = () => {
      setKet(true);
      bao();
    };
    const hen = setTimeout(() => {
      document.addEventListener("keydown", hienHet, true);
      document.addEventListener("pointerdown", hienHet, true);
    }, 0);
    return () => {
      clearTimeout(hen);
      document.removeEventListener("keydown", hienHet, true);
      document.removeEventListener("pointerdown", hienHet, true);
    };
  }, [xong, bao]);

  // Giam chuyen dong hay tai lieu rong: xong ngay, cung tin hieu ket thuc (focus, onDone).
  useEffect(() => {
    if (xong) bao();
  }, [xong, bao]);

  return (
    <div ref={ref} className="giay-noi-dung" aria-busy={!xong && !goXong ? true : undefined}>
      <DocView doc={doc} author={author} typing={xong ? undefined : { shown: n, caret: <span className="con-tro" aria-hidden="true" /> }} />
    </div>
  );
}
