"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type ChangeEvent } from "react";
import { actionUploadMedia } from "@/app/actions/media";
import { IconAnh } from "@/components/media/icons";
import { UploadFailure, UploadProgress } from "@/components/media/UploadLine";
import { COVERS, type CoverKey } from "@/lib/book";
import type { CropRect, ImageSize } from "@/lib/media/crop";
import { HEIF_LOADER_FAILURE, IMAGE_ACCEPT, IMAGE_ERRORS, IMAGE_HINTS, type ImageFailure } from "@/lib/media/image";
import { COVER_LABEL, COVER_NAME, CoverArt } from "./CoverArt";
import { CoverCrop } from "./CoverCrop";
import { CoverImage } from "./CoverImage";
import { encodeCover, readSourceImage, releaseSourceImage, type SourceImage } from "./coverFile";

/** Chu cua dong tai bia, dung cho ca dong hien va vung doc. */
const TAI_BIA = "Đang tải ảnh bìa lên";
/** Chu cua dong doc anh HEIC (bo doc mat vai giay), dung cho ca dong hien va vung doc. */
const DOC_ANH = "Đang đọc ảnh";

/**
 * Bia cua form sach. cover la tranh ve, luon co va la nen du phong. photo la bia tu tai len dang co (cua
 * cuon, hoac vua tai trong phien nay); photoChosen la dang dung photo lam bia.
 */
export type CoverValue = { cover: CoverKey; photo: string | null; photoChosen: boolean };

/** Id bia tu tai len ma form gui len trong truong coverMedia; null la dung tranh ve. */
export function chosenCoverMedia(value: CoverValue): string | null {
  return value.photoChosen ? value.photo : null;
}

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
  /** Cuon dang sua; null la sach moi, bia cho gan toi khi tao sach. */
  bookId: string | null;
  /** Kho media dang bat. Tat thi khong tai len bia moi duoc; bia anh cu van hien va van duoc gui lai nguyen. */
  mediaEnabled: boolean;
  disabled: boolean;
  /** Dang cat hay dang tai bia: form khoa nut gui de khong luu thieu bia vua chon. */
  onBusyChange: (busy: boolean) => void;
};

/**
 * Bang bia cua form sach: cac tranh ve san va o cuoi "Anh cua ban".
 * - Chua co anh: o cuoi la input file phu kin o, dung chung luat focus va bam cua .swatch.
 * - Chon tep: doc anh (readSourceImage), mo buoc cat ngay duoi bang bia; Dung anh nay thi cat, ma hoa va tai len qua
 *   actionUploadMedia loai bia. Xong thi o cuoi thanh radio dang chon ve chinh anh do, kem Doi anh.
 * - Radio anh cung name "cover" voi cac tranh va mang value la tranh du phong, nen truong cover cua form luon la mot tranh
 *   ve; id anh di trong truong an coverMedia.
 * - Tep HEIC ma trinh duyet khong doc duoc: hien Dang doc anh trong luc nap va chay bo doc HEIF; khong nap duoc (mat
 *   mang) thi Thu lai doc lai tep.
 * Moi viec bat dong bo mang mot so luot (run): Huy, chon lai hay go component lam ket qua ve sau bi bo qua.
 */
export function CoverPicker({ value, onChange, bookId, mediaEnabled, disabled, onBusyChange }: CoverPickerProps) {
  const id = useId();
  const [step, setStep] = useState<Step>({ kind: "nghi" });
  const fileRef = useRef<HTMLInputElement>(null);
  const photoRef = useRef<HTMLInputElement>(null);
  const changeRef = useRef<HTMLButtonElement>(null);
  const source = useRef<SourceImage | null>(null);
  const run = useRef(0);
  const focusNext = useRef<"photo" | "pick" | null>(null);
  // Ham bao ban giu trong ref, nhu source va run: hieu ung go component o duoi chi gan mot lan, nen no khong duoc
  // phu thuoc vao mot ham co the doi qua moi lan ve.
  const baoBan = useRef(onBusyChange);

  // Bia anh dang co thi luon hien, ke ca khi kho tat: truong an coverMedia van gui lai id do de sua ten khong
  // lam mat bia, nen o cuoi phai hien dung cai dang duoc gui - khong duoc de mot tranh ve hien la "dang chon"
  // trong khi anh moi la bia that su. Kho tat thi chi mat duong tai len bia MOI (o chon tep va nut Doi anh).
  const showPhoto = value.photo !== null;
  const photoChosen = showPhoto && value.photoChosen;
  const uploading = step.kind === "tai";

  // Focus sau khi DOM da doi: ve radio anh khi tai xong, ve cho chon tep khi huy.
  // useLayoutEffect, khong phai useEffect: layout effect chay ngay trong lan commit da doi DOM. Passive effect cua mot
  // lan commit truoc (vd luc vua sang "tai", do await dat) co the con treo khi nguoi dung bam Huy; React chay no truoc
  // lan render moi, no an mat yeu cau focus vua dat trong khi o chon tep van disabled, va focus roi mat.
  useLayoutEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    (target === "photo" ? photoRef : value.photo !== null ? changeRef : fileRef).current?.focus();
  });

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

  // Cung mot cong: nut Doi anh (disabled tren chinh no), nut Chon anh khac o buoc cat va o dong loi (hai nut
  // ay khong o trong file nay nen khong gan disabled truc tiep len chung duoc) deu goi ham nay.
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
    focusNext.current = "photo";
    go({ kind: "nghi" });
    onChange((v) => ({ ...v, photo: result.id, photoChosen: true }));
  }

  function back() {
    dropSource();
    focusNext.current = "pick";
    go({ kind: "nghi" });
  }

  const retry = step.kind === "loi" ? step.retry : null;
  const status = step.kind === "tai" ? TAI_BIA : step.kind === "doc" ? DOC_ANH : step.kind === "loi" ? [step.message, step.hint].filter(Boolean).join(" ") : "";

  return (
    <fieldset className="chon" aria-describedby={photoChosen ? `${id}-du-phong` : undefined}>
      <legend>Bìa</legend>
      <div className="picker">
        {COVERS.map((c) => (
          <label key={c} className={`swatch bia--${c}`}>
            <input
              type="radio"
              name="cover"
              value={c}
              checked={!photoChosen && value.cover === c}
              disabled={disabled}
              onChange={() => onChange((v) => ({ ...v, cover: c, photoChosen: false }))}
              aria-label={COVER_LABEL[c]}
            />
            <CoverArt cover={c} />
          </label>
        ))}
        {/*
         * Hai nhanh nay cung mot vi tri va deu ve mot the <input>, nen khong co key rieng thi React dung lai CHINH
         * nut DOM cu: o chon tep (type=file, khong value, khong kiem soat) bien thanh o radio (co value va checked,
         * co kiem soat). React canh bao "changing an uncontrolled input to be controlled", va nut DOM con giu lai
         * tep da chon cua lan truoc. Key khac nhau buoc React go nhanh cu ra roi dung nhanh moi.
         */}
        {showPhoto ? (
          <label key="anh-da-chon" className={`swatch bia--${value.cover}`}>
            <input
              ref={photoRef}
              type="radio"
              name="cover"
              value={value.cover}
              checked={photoChosen}
              disabled={disabled}
              onChange={() => onChange((v) => ({ ...v, photoChosen: true }))}
              aria-label="Ảnh của bạn"
            />
            <CoverArt cover={value.cover} />
            <CoverImage mediaId={value.photo} />
          </label>
        ) : (
          mediaEnabled && (
            <label key="chon-tep" className="swatch swatch--anh">
              <input
                ref={fileRef}
                type="file"
                accept={IMAGE_ACCEPT}
                disabled={disabled || uploading}
                onChange={open}
                aria-label="Ảnh của bạn, chọn ảnh làm bìa"
              />
              <IconAnh />
              <span aria-hidden="true">Ảnh của bạn</span>
            </label>
          )
        )}
      </div>
      {(showPhoto && mediaEnabled) || photoChosen ? (
        <div className="bia-anh">
          {showPhoto && mediaEnabled && (
            <>
              <button ref={changeRef} className="btn btn--line btn--sm" type="button" disabled={disabled || uploading} onClick={pick}>
                Đổi ảnh
              </button>
              <input
                ref={fileRef}
                className="sr-only"
                type="file"
                accept={IMAGE_ACCEPT}
                tabIndex={-1}
                aria-hidden="true"
                disabled={disabled || uploading}
                onChange={open}
              />
            </>
          )}
          {photoChosen && (
            <p className="field__help" id={`${id}-du-phong`}>{`Ảnh chưa tải được thì bìa hiện tranh ${COVER_NAME[value.cover]}.`}</p>
          )}
        </div>
      ) : null}
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
      <input type="hidden" name="coverMedia" value={chosenCoverMedia(value) ?? ""} />
    </fieldset>
  );
}
