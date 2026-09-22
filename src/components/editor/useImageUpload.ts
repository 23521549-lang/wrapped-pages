"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { actionUploadMedia } from "@/app/actions/media";
import { imageErrorText, type ImageProblem } from "@/lib/media/image";
import type { ImageAttrs } from "@/lib/media/node";
import { processImage } from "./processImage";

/** Dong "Da chen anh." tu an sau chung nay. */
export const XONG_HIEN_MS = 3_000;

/** Chu cua dong tai anh o cac buoc dang chay, dung cho ca dong hien va vung doc cua man viet. */
export const IMAGE_STATUS = {
  "thu-nho": "Đang thu nhỏ ảnh",
  "tai-len": "Đang tải ảnh lên",
  xong: "Đã chèn ảnh.",
} as const;

export type ImageUploadState =
  | { kind: "nghi" }
  | { kind: "thu-nho" }
  | { kind: "tai-len"; preview: string }
  | { kind: "xong"; preview: string }
  | { kind: "loi"; problem: ImageProblem; preview: string | null };

type Options = {
  bookId: string;
  /** Tai len xong: chen khoi anh vao trang. */
  onInsert: (attrs: ImageAttrs) => void;
  /** Doc mot cau cho trinh doc man hinh qua vung doc cua man viet. */
  announce: (text: string) => void;
};

/**
 * Luong them anh cua man viet: xu ly o trinh duyet, tai len bang actionUploadMedia, chen khoi voi
 * id va kich thuoc that may chu tra ve. Mot anh mot luc. Server action khong bao tien do tai len, nen thanh tien do chay
 * khong xac dinh. Thu lai dung lai anh da xu ly. Huy hay dong thi bo ket qua cua luot dang chay; tep da len kho (neu co)
 * thanh rac va duoc don sau 24 gio.
 */
export function useImageUpload({ bookId, onInsert, announce }: Options) {
  const [state, setState] = useState<ImageUploadState>({ kind: "nghi" });
  const luot = useRef(0);
  const anh = useRef<{ blob: Blob; preview: string } | null>(null);
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goi = useRef({ onInsert, announce });

  useLayoutEffect(() => {
    goi.current = { onInsert, announce };
  });

  useEffect(
    () => () => {
      luot.current += 1;
      if (hen.current) clearTimeout(hen.current);
      if (anh.current) URL.revokeObjectURL(anh.current.preview);
    },
    [],
  );

  function doi(next: ImageUploadState) {
    setState(next);
    // ImageUploadLine ve dong goi y ngay duoi cau loi cho nguoi nhin duoc; vung doc phai doc ca hai cau, khong thi
    // nguoi dung trinh doc man hinh chi nghe cau loi ma khong nghe phai lam gi tiep theo.
    if (next.kind === "loi") goi.current.announce(imageErrorText(next.problem));
    else if (next.kind !== "nghi") goi.current.announce(IMAGE_STATUS[next.kind]);
  }

  /** Bo luot dang chay, hen gio tu an va anh da xu ly. */
  function don() {
    luot.current += 1;
    if (hen.current) clearTimeout(hen.current);
    hen.current = null;
    if (anh.current) URL.revokeObjectURL(anh.current.preview);
    anh.current = null;
  }

  function close() {
    don();
    setState({ kind: "nghi" });
  }

  async function taiLen(ma: number) {
    const daXuLy = anh.current;
    if (!daXuLy) return;
    doi({ kind: "tai-len", preview: daXuLy.preview });
    const fd = new FormData();
    fd.set("kind", "anh");
    fd.set("book", bookId);
    fd.set("file", daXuLy.blob, "anh");
    const r = await actionUploadMedia(fd).catch(() => null);
    if (ma !== luot.current) return;
    if (!r || "error" in r || r.w === undefined) {
      doi({ kind: "loi", problem: "upload", preview: daXuLy.preview });
      return;
    }
    goi.current.onInsert({ id: r.id, w: r.w, h: r.h });
    doi({ kind: "xong", preview: daXuLy.preview });
    hen.current = setTimeout(close, XONG_HIEN_MS);
  }

  async function pick(file: File) {
    don();
    const ma = luot.current;
    doi({ kind: "thu-nho" });
    const ket = await processImage(file);
    if (ma !== luot.current) return;
    if ("problem" in ket) {
      doi({ kind: "loi", problem: ket.problem, preview: null });
      return;
    }
    anh.current = { blob: ket.blob, preview: URL.createObjectURL(ket.blob) };
    await taiLen(ma);
  }

  function retry() {
    luot.current += 1;
    void taiLen(luot.current);
  }

  return { state, busy: state.kind === "thu-nho" || state.kind === "tai-len", pick, retry, close };
}
