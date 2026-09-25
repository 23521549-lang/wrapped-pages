"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTamDung } from "@/components/hieu-ung/tam-dung";
import { giamChuyenDong } from "@/components/tam-trang/hieu-ung-chung";
import type { CoverKey } from "@/lib/book";
import { DOI_BIA_MS, DON_TRE_MS, ROI_SANG_MS, kenBiaCu, kenVetSang, khungBiaCu, khungVetSang } from "@/lib/roi-sang";
import { taoTuiXao } from "@/lib/tui-xao";
import { CoverArt } from "./CoverArt";
import { CoverImage } from "./CoverImage";

/** Mot o bia da co tren dong thoi gian cua cuon. */
export type BiaChon = { cover: CoverKey; coverMediaId: string | null };

export type BiaTuDoiProps = {
  /** Moi o bia DA CO cua cuon, theo thu tu dong thoi gian. Mot bia thi khung dung yen tuyet doi. */
  covers: readonly BiaChon[];
  /** Trang Dau thoi gian cua cuon: bam anh bia la mot loi vao thang (diem 15 cua chu du an). */
  href: string;
  /** Ten doc duoc cua lien ket, vi du "Dấu thời gian của Chuyện chưa kể". */
  nhan: string;
};

const NHAN_DUNG = "Tạm dừng hiệu ứng";
const NHAN_CHAY = "Cho hiệu ứng chạy";

/**
 * Khung bia cua khung sach lon, tu doi bia muoi giay mot lan bang hieu ung roi sang. Chi cuon co TU HAI BIA TRO LEN
 * moi doi; cuon mot bia thi khong mot hen gio nao duoc dat.
 *
 * So sach cua hieu ung nay nam ngay trong cac ref cua chinh no chu khong dung mo dun so sach cua dai troi: o day chi
 * co mot hen gio va hai hoat hinh, con mo dun kia sinh ra cho mot dai troi voi hang tram vet nuoc va hai hieu ung
 * tranh nhau mot khoa. Muon mot cai bang nho vao mot bai toan khac la them mot rang buoc khong ai can.
 *
 * Duong dung, theo WCAG SC 2.2.2 (noi dung tu cap nhat keo dai qua 5 giay, nam song song voi noi dung khac):
 * trang bi an, con tro dang tren khung, khung dang giu focus, nguoi dung da chon tam dung, hay may dang bat giam
 * chuyen dong - bat ky dieu nao cung lam hen gio khong duoc dat. Het dieu do thi hen gio duoc dat lai.
 */
export function BiaTuDoi({ covers, href, nhan }: BiaTuDoiProps) {
  const [hien, setHien] = useState<BiaChon>(covers[0]);
  /** Bia dang mo di trong lan doi nay; null la khong co lan doi nao dang chay. */
  const [cu, setCu] = useState<BiaChon | null>(null);
  const [dung] = useTamDung();
  const [giam, setGiam] = useState(false);
  const [an, setAn] = useState(false);
  const [giu, setGiu] = useState(false);

  const khungRef = useRef<HTMLDivElement>(null);
  const cuRef = useRef<HTMLDivElement>(null);
  const vetRef = useRef<HTMLSpanElement>(null);
  const henRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoatRef = useRef<Animation[]>([]);
  const rutRef = useRef<(() => BiaChon) | null>(null);

  const doiDuoc = covers.length > 1;
  const chay = doiDuoc && !dung && !giam && !an && !giu;

  // Tui xao dung theo chinh danh sach bia, va chi dung lai khi danh sach that su doi (chu sach vua sua mot o). Khoa la
  // noi dung chu khong phai dinh danh mang: mot lan ve lai cua trang cha khong duoc lam bia nhay ve o dau tien.
  const khoa = covers.map((c) => `${c.cover}:${c.coverMediaId ?? ""}`).join("|");
  useLayoutEffect(() => {
    // Truyen bia dang hien vao tui: lan rut dau tien cung khong duoc trung no, khong thi nguoi dung thay mot lan
    // "doi bia" ma bia khong doi gi.
    rutRef.current = covers.length > 0 ? taoTuiXao(covers, Math.random, covers[0]) : null;
    // oxlint-disable-next-line react/set-state-in-effect -- Dong bo voi mot prop vua doi noi dung: danh sach bia moi thi tui xao va bia dang hien deu phai dung lai tu dau.
    setHien(covers[0]);
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- Co y chi phu thuoc vao NOI DUNG danh sach (khoa), khong phu thuoc dinh danh mang: cha ve lai la mang moi, ma bia thi khong duoc nhay ve o dau tien.
  }, [khoa]);

  // Giam chuyen dong doc tren trinh duyet, khong doc luc render: may chu khong co matchMedia.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- Dong bo voi he thong ngoai (matchMedia): khong doc duoc luc render vi may chu khong co matchMedia, doc luc do la HTML may chu gui xuong lech voi lan ve dau cua trinh duyet.
    setGiam(giamChuyenDong());
    const mq = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (mq === undefined) return;
    const nghe = () => setGiam(mq.matches);
    mq.addEventListener("change", nghe);
    return () => mq.removeEventListener("change", nghe);
  }, []);

  // Trang bi an thi khong doi bia: nguoi dung khong nhin, va tab quay lai sau mot luc lau khong duoc no mot loat.
  useEffect(() => {
    const nghe = () => setAn(document.visibilityState === "hidden");
    nghe();
    document.addEventListener("visibilitychange", nghe);
    return () => document.removeEventListener("visibilitychange", nghe);
  }, []);

  /** Don mot lan doi: tra mat bia moi ve, go lop tam va huy moi hoat hinh - ca ba trong CUNG mot luot. */
  const don = useCallback(() => {
    for (const a of hoatRef.current) a.cancel();
    hoatRef.current = [];
    setCu(null);
  }, []);

  // Chay mot lan doi: bia moi da nam san o duoi (state hien da doi), lop tam mang bia cu va vet sang.
  useLayoutEffect(() => {
    if (cu === null) return;
    const cuEl = cuRef.current;
    const vetEl = vetRef.current;
    if (!cuEl || !vetEl) return;
    const a1 = cuEl.animate(khungBiaCu(), kenBiaCu());
    const a2 = vetEl.animate(khungVetSang(), kenVetSang());
    hoatRef.current = [a1, a2].filter((a): a is Animation => a !== undefined);
    const id = setTimeout(don, ROI_SANG_MS + DON_TRE_MS);
    return () => {
      clearTimeout(id);
      for (const a of hoatRef.current) a.cancel();
      hoatRef.current = [];
    };
  }, [cu, don]);

  // Hen gio: chi dat khi khong co dieu kien dung nao, va chi mot cai. Dat lai sau moi lan doi da don xong.
  useEffect(() => {
    if (!chay || cu !== null) return;
    const id = setTimeout(() => {
      const rut = rutRef.current;
      if (!rut) return;
      // Bia moi thanh bia dang hien (no nam san o duoi va khong bi dong vao), bia cu len lop tam de mo di.
      setCu(hien);
      setHien(rut());
    }, DOI_BIA_MS);
    henRef.current = id;
    return () => {
      clearTimeout(id);
      henRef.current = null;
    };
  }, [chay, cu, hien]);

  // Ca tranh dan la mot lien ket rieng toi trang Dau thoi gian. No nam NGOAI lop phu cua khung sach trong cay (nen khong
  // co lien ket long nhau) va TREN lop phu theo thu tu lop (app.css), nen nhan duoc cu bam, con tro va focus: nho vay
  // hen gio moi dung duoc khi con tro dang tren bia hay khi bia dang giu focus.
  return (
    <Link
      className="tranh-dan__lien"
      href={href}
      onPointerEnter={() => setGiu(true)}
      onPointerLeave={() => setGiu(false)}
      onFocus={() => setGiu(true)}
      onBlur={() => setGiu(false)}
    >
      <span className="sr-only">{nhan}</span>
      <span className="tranh-dan__to">
        <span ref={khungRef} className={`tranh-dan__bia bia--${hien.cover}`}>
          <CoverArt cover={hien.cover} />
          <CoverImage mediaId={hien.coverMediaId} />
          {cu !== null && (
            <span className="roi-sang" aria-hidden="true">
              <span ref={cuRef} className={`roi-sang__cu bia--${cu.cover}`}>
                <CoverArt cover={cu.cover} />
                <CoverImage mediaId={cu.coverMediaId} />
              </span>
              <span ref={vetRef} className="roi-sang__vet" />
            </span>
          )}
        </span>
      </span>
    </Link>
  );
}

/**
 * Nut tam dung du phong cua trang Ke sach, chi dat khi trang khong co dai troi (khong ai dang giu tam trang): khong co
 * no thi bia tu doi ma khong co duong dung nao, trai WCAG SC 2.2.2. Nut doi DUNG lua chon da luu ma dai troi van dung,
 * nen van la mot co che chu khong phai hai (phan quyet B4). May bat giam chuyen dong thi khong co gi chay, va nut duoc
 * giau bang CSS - cung cach voi nut cua dai troi - de HTML may chu va lan ve dau cua trinh duyet khong lech nhau.
 */
export function NutDungHieuUng() {
  const [dung, datDung] = useTamDung();
  return (
    <button type="button" className="btn btn--chu bia-dung" onClick={() => datDung(!dung)}>
      {dung ? NHAN_CHAY : NHAN_DUNG}
    </button>
  );
}
