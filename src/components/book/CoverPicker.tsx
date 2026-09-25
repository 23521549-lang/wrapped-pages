"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { actionUploadMedia } from "@/app/actions/media";
import { IconAnh } from "@/components/media/icons";
import { UploadFailure, UploadProgress } from "@/components/media/UploadLine";
import { COVERS, COVER_LABEL, COVER_NAME, type CoverKey } from "@/lib/book";
import type { CropRect, ImageSize } from "@/lib/media/crop";
import { HEIF_LOADER_FAILURE, IMAGE_ACCEPT, IMAGE_ERRORS, IMAGE_HINTS, type ImageFailure } from "@/lib/media/image";
import { CoverArt } from "./CoverArt";
import { CoverCrop } from "./CoverCrop";
import { CoverImage } from "./CoverImage";
import { encodeCover, readSourceImage, releaseSourceImage, type SourceImage } from "./coverFile";

/** Chu cua dong tai bia, dung cho ca dong hien va vung doc. */
const TAI_BIA = "Đang tải ảnh bìa lên";
/** Chu cua dong doc anh HEIC (bo doc mat vai giay), dung cho ca dong hien va vung doc. */
const DOC_ANH = "Đang đọc ảnh";
/** Nhan cua o anh vua tai len trong chinh phien nay: chua co moc ngay de goi ten. */
const VUA_TAI = "Ảnh của bạn, vừa tải lên";

/**
 * Mot anh trong kho bia cua cuon, da san sang de ve. nhan do may chu dung san (vi du "Ảnh của bạn, tải 20.09"): trinh
 * duyet khong dinh dang ngay, nen lan ve o may chu va lan ve lai o trinh duyet khong bao gio lech nhau.
 */
export type CoverPhotoView = { id: string; nhan: string };

/**
 * Bia dang chon. cover la tranh ve, luon di kem lam nen du phong; photoId khac null la mot o anh trong kho dang duoc
 * chon. cover null chi xay ra o trang Viet tiep, nghia la "giu bia dang dung, luot nay khong them o bia nao".
 */
export type CoverValue = { cover: CoverKey | null; photoId: string | null };

/** Viec dang lam cua o bia anh. Anh goc cua buoc cat nam trong ref, vi phai giai phong dung luc. */
type Step =
  | { kind: "nghi" }
  | { kind: "doc" }
  | { kind: "cat"; size: ImageSize; previewUrl: string }
  | { kind: "tai" }
  | { kind: "loi"; message: string; hint: string | null; retry: (() => void) | null };

export type CoverPickerProps = {
  value: CoverValue;
  /** Nhan ham cap nhat, vi ket qua tai len ve sau khi nguoi dung co the da doi tranh. */
  onChange: (update: (value: CoverValue) => CoverValue) => void;
  /** Kho anh cua cuon, moi nhat truoc. Sach moi thi rong. */
  photos: readonly CoverPhotoView[];
  /** Co o "Giu bia dang dung" o dau bang khong. Chi trang Viet tiep bat: hai noi kia bat buoc phai co mot bia. */
  giuDuoc: boolean;
  /** Cuon dang sua; null la sach moi, bia cho gan toi khi tao sach. */
  bookId: string | null;
  /** Kho media dang bat. Tat thi khong tai len bia moi duoc; moi anh da co trong kho van hien va van chon duoc. */
  mediaEnabled: boolean;
  disabled: boolean;
  /** Dang cat hay dang tai bia: form khoa nut gui de khong luu thieu bia vua chon. */
  onBusyChange: (busy: boolean) => void;
};

/**
 * Bang bia cua form sach: o "Giu bia dang dung" (neu co), muoi tranh ve san, ca kho anh cua cuon (moi nhat truoc), roi
 * o chon tep o cuoi.
 * - Tai mot anh moi chi THEM mot o vao bang va tu chon o do; khong o nao bi thay cho, ke ca anh chua o nao dung toi.
 * - Radio anh cung name "cover" voi cac tranh va mang value la tranh du phong, nen truong cover cua form luon la mot
 *   tranh ve; id anh di trong truong an coverMedia.
 * - Tep HEIC ma trinh duyet khong doc duoc: hien Dang doc anh trong luc nap va chay bo doc HEIF; khong nap duoc (mat
 *   mang) thi Thu lai doc lai tep.
 * Ca bang nam trong mot vung cuon an thanh cuon, co vet mo o day (cung cach voi cot Hoat dong), nen kho anh lon toi dau
 * cung khong keo dai form.
 * Moi viec bat dong bo mang mot so luot (run): Huy, chon lai hay go component lam ket qua ve sau bi bo qua.
 */
export function CoverPicker({ value, onChange, photos, giuDuoc, bookId, mediaEnabled, disabled, onBusyChange }: CoverPickerProps) {
  const id = useId();
  const [step, setStep] = useState<Step>({ kind: "nghi" });
  /** Anh tai len trong chinh phien nay, moi nhat truoc. Kho tu may chu chi doi sau khi trang duoc lam moi. */
  const [them, setThem] = useState<CoverPhotoView[]>([]);
  const hopRef = useRef<HTMLFieldSetElement>(null);
  const vungRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const source = useRef<SourceImage | null>(null);
  const run = useRef(0);
  /** Id anh can dua focus toi sau khi DOM doi, hoac "pick" cho o chon tep. */
  const focusNext = useRef<string | null>(null);
  // Ham bao ban giu trong ref, nhu source va run: hieu ung go component o duoi chi gan mot lan, nen no khong duoc
  // phu thuoc vao mot ham co the doi qua moi lan ve.
  const baoBan = useRef(onBusyChange);

  const uploading = step.kind === "tai";
  // Anh tai trong phien nay bi bo ra khoi phan "them" ngay khi may chu da gui no ve trong kho: khong the thi mot lan
  // lam moi trang (vi du luu mot o khac trong cung man Sua sach) se liet ke no hai lan.
  const kho = [...them.filter((t) => !photos.some((p) => p.id === t.id)), ...photos];
  const duPhong = value.cover ?? COVERS[0];

  // Focus sau khi DOM da doi: ve o anh vua tai xong, ve o chon tep khi huy.
  // useLayoutEffect, khong phai useEffect: layout effect chay ngay trong lan commit da doi DOM. Passive effect cua mot
  // lan commit truoc (vd luc vua sang "tai", do await dat) co the con treo khi nguoi dung bam Huy; React chay no truoc
  // lan render moi, no an mat yeu cau focus vua dat trong khi o chon tep van disabled, va focus roi mat.
  useLayoutEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    if (target === "pick") fileRef.current?.focus();
    else hopRef.current?.querySelector<HTMLInputElement>(`input[data-anh="${target}"]`)?.focus();
  });

  // Keo o dang chon vao tam nhin bang scrollTop cua CHINH vung cuon. scrollIntoView se cuon ca trang va lam man nhay.
  // useLayoutEffect vi viec nay phai xong truoc khung hinh dau, khong duoc de nguoi dung thay bang bia nhay mot cai.
  useLayoutEffect(() => {
    const vung = vungRef.current;
    const o = vung?.querySelector<HTMLInputElement>("input:checked")?.closest<HTMLElement>(".swatch");
    if (!vung || !o) return;
    vung.scrollTop = Math.max(0, o.offsetTop - (vung.clientHeight - o.offsetHeight) / 2);
  }, []);

  useEffect(() => {
    baoBan.current = onBusyChange;
  }, [onBusyChange]);

  useEffect(() => {
    const held = source;
    const runs = run;
    const bao = baoBan;
    return () => {
      runs.current += 1;
      if (held.current) releaseSourceImage(held.current);
      // Go component ra la bo luon viec dang doc hay dang tai (runs.current vua doi, go() cua luot do khong chay nua),
      // nen o bia khong con ban va bia dang doc cung khong di kem lan gui nua. Khong ha co o day thi khong con ai ha:
      // form giu nut gui khoa mai, ke ca sau khi mo lai o bia.
      bao.current(false);
    };
  }, []);

  /** Chuyen viec: moi ket qua dang doi tro thanh cu, va form biet co dang ban khong. */
  function go(next: Step) {
    run.current += 1;
    setStep(next);
    onBusyChange(next.kind === "doc" || next.kind === "cat" || next.kind === "tai");
  }

  function dropSource() {
    if (source.current) releaseSourceImage(source.current);
    source.current = null;
  }

  /** Loi doc anh. Hong bo doc anh iPhone (mat mang) thi Thu lai doc lai dung tep do; loi khac thi chon anh khac. */
  function fail(reason: ImageFailure, file: File | null = null) {
    const retry = reason === HEIF_LOADER_FAILURE && file ? () => void read(file) : null;
    go({ kind: "loi", message: IMAGE_ERRORS[reason], hint: IMAGE_HINTS[reason] ?? null, retry });
  }

  // Cung mot cong: o chon tep, nut Chon anh khac o buoc cat va o dong loi (hai nut ay khong o trong file nay nen khong
  // gan disabled truc tiep len chung duoc) deu goi ham nay.
  function pick() {
    if (disabled || uploading) return;
    fileRef.current?.click();
  }

  function open(e: ChangeEvent<HTMLInputElement>) {
    const file = e.currentTarget.files?.[0];
    // Xoa gia tri de chon lai dung tep do van bao change.
    e.currentTarget.value = "";
    if (file) void read(file);
  }

  async function read(file: File) {
    const mine = ++run.current;
    // Giai ma (toi 40 MB) va ve lai anh xem truoc co the mat vai giay tren dien thoai: khoa nut gui ngay tu day,
    // truoc khi buoc cat kip hien, de khong tao sach thieu bia nguoi viet vua chon. go() se tu cap nhat lai
    // trang thai ban khi buoc cat hien hoac khi doc that bai.
    onBusyChange(true);
    // Tep HEIC can nap bo doc rieng: hien dong "Dang doc anh" co nut Huy. Dat thang setStep, khong qua go(), de luot
    // dang chay (mine) van la luot hien hanh.
    const onHeif = () => {
      if (run.current === mine) setStep({ kind: "doc" });
    };
    // readSourceImage nem loi thay vi tra "broken" khi ve (drawImage) hay ma hoa anh xem truoc (toBlob) nem loi giua
    // chung (vd nguon anh bi dong o noi khac): bat o day de form thoat trang thai ban va hien loi chung, khong treo mai.
    let got;
    try {
      got = await readSourceImage(file, { onHeif });
    } catch {
      if (run.current === mine) fail("broken", file);
      return;
    }
    if (run.current !== mine) {
      if (typeof got !== "string") releaseSourceImage(got);
      return;
    }
    dropSource();
    if (typeof got === "string") return fail(got, file);
    source.current = got;
    go({ kind: "cat", size: got.size, previewUrl: got.previewUrl });
  }

  async function use(rect: CropRect) {
    const held = source.current;
    if (!held) return;
    const mine = ++run.current;
    const encoded = await encodeCover(held, rect);
    if (run.current !== mine) return;
    dropSource();
    if (typeof encoded === "string") return fail(encoded);
    await upload(encoded);
  }

  async function upload(blob: Blob) {
    go({ kind: "tai" });
    const mine = run.current;
    const fd = new FormData();
    fd.set("kind", "bia");
    fd.set("book", bookId ?? "");
    fd.set("file", blob, "bia");
    const result = await actionUploadMedia(fd).catch(() => null);
    if (run.current !== mine) return;
    if (result === null) return go({ kind: "loi", message: IMAGE_ERRORS.upload, hint: null, retry: () => void upload(blob) });
    if ("error" in result) return go({ kind: "loi", message: result.error, hint: null, retry: null });
    focusNext.current = result.id;
    go({ kind: "nghi" });
    // Chi THEM mot o vao bang: khong anh nao bi thay cho, ke ca anh dang khong duoc o nao trong dong thoi gian chon.
    setThem((t) => [{ id: result.id, nhan: VUA_TAI }, ...t]);
    onChange((v) => ({ cover: v.cover ?? COVERS[0], photoId: result.id }));
  }

  function back() {
    dropSource();
    focusNext.current = "pick";
    go({ kind: "nghi" });
  }

  const retry = step.kind === "loi" ? step.retry : null;
  const status = step.kind === "tai" ? TAI_BIA : step.kind === "doc" ? DOC_ANH : step.kind === "loi" ? [step.message, step.hint].filter(Boolean).join(" ") : "";

  return (
    <fieldset ref={hopRef} className="chon" aria-describedby={value.photoId !== null ? `${id}-du-phong` : undefined}>
      <legend>Bìa</legend>
      <div className="cuon-vung" ref={vungRef}>
        <div className="picker">
          {giuDuoc && (
            <label className="swatch swatch--giu">
              <input
                type="radio"
                name="cover"
                value=""
                checked={value.cover === null}
                disabled={disabled}
                onChange={() => onChange(() => ({ cover: null, photoId: null }))}
                aria-label="Giữ bìa đang dùng, lượt này không thêm bìa"
              />
              <span aria-hidden="true">Giữ bìa đang dùng</span>
            </label>
          )}
          {COVERS.map((c) => (
            <label key={c} className={`swatch bia--${c}`}>
              <input
                type="radio"
                name="cover"
                value={c}
                checked={value.photoId === null && value.cover === c}
                disabled={disabled}
                onChange={() => onChange((v) => ({ ...v, cover: c, photoId: null }))}
                aria-label={COVER_LABEL[c]}
              />
              <CoverArt cover={c} />
            </label>
          ))}
          {kho.map((p) => (
            <label key={p.id} className={`swatch bia--${duPhong}`}>
              <input
                type="radio"
                name="cover"
                value={duPhong}
                data-anh={p.id}
                checked={value.photoId === p.id}
                disabled={disabled}
                onChange={() => onChange((v) => ({ cover: v.cover ?? COVERS[0], photoId: p.id }))}
                aria-label={p.nhan}
              />
              <CoverArt cover={duPhong} />
              <CoverImage mediaId={p.id} />
            </label>
          ))}
          {mediaEnabled && (
            <label className="swatch swatch--anh">
              <input
                ref={fileRef}
                type="file"
                accept={IMAGE_ACCEPT}
                disabled={disabled || uploading}
                onChange={open}
                aria-label="Thêm ảnh của bạn làm bìa"
              />
              <IconAnh />
              <span aria-hidden="true">Thêm ảnh</span>
            </label>
          )}
        </div>
      </div>
      {value.photoId !== null && (
        <p className="field__help" id={`${id}-du-phong`}>{`Ảnh chưa tải được thì bìa hiện tranh ${COVER_NAME[duPhong]}.`}</p>
      )}
      {step.kind === "cat" && (
        <CoverCrop key={step.previewUrl} size={step.size} previewUrl={step.previewUrl} onUse={use} onPickAgain={pick} onCancel={back} />
      )}
      {step.kind === "doc" && <UploadProgress label={DOC_ANH} cancelLabel="Hủy đọc ảnh" preview={null} onCancel={back} />}
      {step.kind === "tai" && <UploadProgress label={TAI_BIA} cancelLabel="Hủy tải ảnh bìa" preview={null} onCancel={back} />}
      {step.kind === "loi" && (
        <UploadFailure message={step.message} hint={step.hint} preview={null} onRetry={retry} onPick={pick} onClose={back} />
      )}
      {/* Mot vung doc giu nguyen qua moi trang thai, nen trinh doc man hinh doc duoc cau tai va cau loi moi. */}
      <output className="sr-only">{status}</output>
      <input type="hidden" name="coverMedia" value={value.photoId ?? ""} />
    </fieldset>
  );
}
