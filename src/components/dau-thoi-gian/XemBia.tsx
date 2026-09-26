"use client";

import { useEffect, useEffectEvent, useRef, useState, type RefObject } from "react";
import Link from "next/link";
import { CoverArt } from "@/components/book/CoverArt";
import { CoverImage } from "@/components/book/CoverImage";
import { giamChuyenDong } from "@/components/tam-trang/hieu-ung-chung";
import type { CoverKey } from "@/lib/book";
import { troNgoai } from "./tro-ngoai";

/** Mot bia trong trinh xem: tranh, luot nao, luc nao, doc tu dau. */
export type BiaXem = {
  key: string;
  cover: CoverKey;
  coverMediaId: string | null;
  /** "Lượt 5, trang 7 tới 8" hay "Lúc tạo sách". */
  nhan: string;
  gio: string;
  docHref: string;
  docNhan: string;
};

/**
 * Nhip cua chong the, khop voi dau-thoi-gian.css. LAT_MS: sau chung nay the vua bay ra duoc xep xuong cuoi xap va bam
 * tiep duoc (the con dang mo dan, --dur-the-bia dai hon). DONG_MS: bang --dur-nen-xem, lop nen mo het roi moi go ra.
 * Giam chuyen dong thi moi thu chi mo chong 150ms.
 */
const LAT_MS = 520;
const DONG_MS = 600;
const GIAM_MS = 150;

/**
 * Trinh xem bia giua man hinh (spec bo sung B4 ban hai): cac bia cua mot ngay xep thanh chong the tren lop nen giay mo.
 * Bam the tren cung (hay phim →) thi no luot sang phai roi lui xuong cuoi xap, lo bia ke tiep; phim ← lui lai. Dong bang
 * nut Dong, bam ra nen, hay Esc; focus ve lai cho da mo. Trong luc mo, moi thu ngoai trinh xem va the nhac `giuRef` (dang
 * noi o goc, tren lop nen) la inert, va trang khong cuon. Xem bia khong dung toi nhac.
 */
export function XemBia({ bia, tenNgay, giuRef, onDong }: {
  bia: readonly BiaXem[];
  tenNgay: string;
  giuRef: RefObject<HTMLElement | null> | null;
  onDong: () => void;
}) {
  const n = bia.length;
  const khungRef = useRef<HTMLDialogElement>(null);
  const theRef = useRef<(HTMLButtonElement | null)[]>([]);
  const [dinh, setDinh] = useState(0);
  /** The vua bi lat qua, dang luot ra ben phai. */
  const [bay, setBay] = useState<number | null>(null);
  const [mo, setMo] = useState(false);
  const khoa = useRef(false);
  const dangDong = useRef(false);
  const hen = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const khung = khungRef.current;
    if (!khung) return;
    const giu = giuRef?.current ?? null;
    const veLai = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const goInert = troNgoai(giu === null ? [khung] : [khung, giu]);
    // Khoa cuon trang phia sau. Thanh cuon bien mat thi bu dung be rong cua no vao padding: trang khong xo sang phai, ma
    // lop nen co dinh van phu tron be ngang (giu cho bang scrollbar-gutter thi lop nen chua mot dai ho ben phai).
    const html = document.documentElement;
    const cu = { overflow: html.style.overflow, padding: html.style.paddingRight };
    const rongThanhCuon = globalThis.innerWidth - html.clientWidth;
    html.style.overflow = "hidden";
    if (rongThanhCuon > 0) html.style.paddingRight = `${rongThanhCuon}px`;
    // O man hep the nhac trai ngang day man hinh: trinh xem chua cho dung bang chieu cao cua no.
    const doCao = () => khung.style.setProperty("--dtg-chen", `${giu?.offsetHeight ?? 0}px`);
    doCao();
    const quan = giu === null ? null : new ResizeObserver(doCao);
    if (giu !== null) quan?.observe(giu);
    const khungHinh = requestAnimationFrame(() => setMo(true));
    const cacHen = hen.current;
    return () => {
      cancelAnimationFrame(khungHinh);
      for (const h of cacHen) clearTimeout(h);
      quan?.disconnect();
      goInert();
      html.style.overflow = cu.overflow;
      html.style.paddingRight = cu.padding;
      veLai?.focus();
    };
  }, [giuRef]);

  // The tren cung luon giu focus: luc mo, va sau moi lan lat.
  useEffect(() => {
    theRef.current[dinh]?.focus();
  }, [dinh]);

  const dong = () => {
    if (dangDong.current) return;
    dangDong.current = true;
    setMo(false);
    hen.current.push(setTimeout(onDong, giamChuyenDong() ? GIAM_MS : DONG_MS));
  };

  const lat = (huong: 1 | -1) => {
    if (khoa.current || n < 2) return;
    khoa.current = true;
    const giam = giamChuyenDong();
    if (huong === 1) {
      setBay(dinh);
      setDinh((dinh + 1) % n);
      hen.current.push(setTimeout(() => {
        setBay(null);
        khoa.current = false;
      }, giam ? GIAM_MS : LAT_MS));
      return;
    }
    // Lui lai: the moi len dinh bat dau tu ben phai (khong chuyen dong), roi truot vao cho.
    const moi = (dinh - 1 + n) % n;
    const the = theRef.current[moi];
    if (the) {
      the.style.transition = "none";
      the.dataset.o = "-1";
      void the.offsetWidth;
      the.style.transition = "";
    }
    setDinh(moi);
    hen.current.push(setTimeout(() => {
      khoa.current = false;
    }, giam ? GIAM_MS : LAT_MS));
  };

  // Phim nghe o ca tai lieu: Esc dong trinh xem ca khi focus dang o the nhac noi ngoai trinh xem; ← → lat the.
  const khiPhim = useEffectEvent((e: KeyboardEvent) => {
    if (e.key === "Escape") dong();
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      lat(e.key === "ArrowRight" ? 1 : -1);
    }
  });
  useEffect(() => {
    const phim = (e: KeyboardEvent) => khiPhim(e);
    document.addEventListener("keydown", phim);
    return () => document.removeEventListener("keydown", phim);
  }, []);

  const tren = bia[dinh];
  // <dialog open> khong modal (khong showModal): modal nam o lop tren cung va se de len the nhac. Phan con lai cua trang
  // bi khoa bang inert (troNgoai) thay cho modal.
  return (
    <dialog ref={khungRef} open className={mo ? "dtg-xem dtg-xem--mo" : "dtg-xem"} aria-label={`Bìa trong ngày ${tenNgay}`}>
      {/* Lop nen chi nhan cu bam chuot hay cham de dong; ban phim dong bang Esc hay nut Dong. */}
      <div className="dtg-xem__nen" aria-hidden="true" onClick={dong} />
      <div className="dtg-xem__giua">
        <button type="button" className="btn btn--quiet dtg-xem__dong" onClick={dong}>Đóng</button>
        <p className="dtg-xem__dem" aria-hidden="true">{`Bìa ${dinh + 1} / ${n}`}</p>
        <div className="dtg-xem__boc">
          {bia.map((b, i) => {
            const vt = (i - dinh + n) % n;
            const laTren = vt === 0 && i !== bay;
            return (
              <button
                key={b.key}
                ref={(el) => {
                  theRef.current[i] = el;
                }}
                type="button"
                className="dtg-the-bia"
                data-o={i === bay ? -1 : Math.min(vt, 3)}
                tabIndex={laTren ? 0 : -1}
                aria-hidden={laTren ? undefined : true}
                aria-label={`Bìa ${vt + 1} trên ${n}, ${b.nhan.toLowerCase()}${n > 1 ? ". Bấm để xem bìa kế tiếp" : ""}`}
                onClick={() => lat(1)}
              >
                <span className={`bia bia--${b.cover}`}>
                  <CoverArt cover={b.cover} />
                  <CoverImage mediaId={b.coverMediaId} />
                </span>
              </button>
            );
          })}
        </div>
        <div className="dtg-xem__chu">
          <b>{tren.nhan}</b>
          <span>{`Bìa mới lúc ${tren.gio}`}</span>
          <Link className="btn btn--chu" href={tren.docHref}>{tren.docNhan}</Link>
        </div>
        {n > 1 && (
          <p className="dtg-xem__goi">
            <span className="dtg-xem__goi-rong">Bấm vào bìa, hay phím →, để xem bìa kế tiếp. Phím ← để lùi lại.</span>
            <span className="dtg-xem__goi-hep">Chạm vào bìa để xem bìa kế tiếp.</span>
          </p>
        )}
      </div>
      <div className="dtg-xem__chen" aria-hidden="true" />
    </dialog>
  );
}
