"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { IconAnh, IconMic } from "@/components/media/icons";
import { ImageUploadLine } from "./ImageUploadLine";
import { insertMediaBlock } from "./insertMedia";
import { DA_CHEN_GHI_AM, mediaAnnouncement } from "./mediaAnnounce";
import { RecorderBox } from "./RecorderBox";
import { Toolbar } from "./Toolbar";
import { useImageUpload } from "./useImageUpload";

export type MediaToolsProps = {
  editor: TiptapEditor | null;
  bookId: string;
  author: string;
  mediaEnabled: boolean;
  /** Loi bao cho vung aria-live cua man goi (chon, bo, chen khoi media, tien trinh tai anh). */
  announce: (message: string) => void;
  /** Nut them vao thanh cong cu, sau o chon tep va truoc dong ghi chu kho tat (vd "Tap trung" cua man viet). */
  extra?: ReactNode;
};

/**
 * Thanh cong cu dinh dang kem nhom "Them anh", "Ghi am", roi dong tai anh va hop ghi am ngay duoi. Dung chung cho man viet
 * va man sua mot to. Kho media tat thi hai nut mo di, van Tab toi duoc, kem mot cau ghi chu.
 */
export function MediaTools({ editor, bookId, author, mediaEnabled, announce, extra }: MediaToolsProps) {
  // Chen khoi bang editor moi nhat, khong bang closure cu cua lan render luc bat dau tai anh hay ghi am.
  const editorRef = useRef<TiptapEditor | null>(null);
  const [ghiMo, setGhiMo] = useState(false);
  const chonAnhRef = useRef<HTMLInputElement>(null);
  const nutGhiRef = useRef<HTMLButtonElement>(null);
  const hopGhiId = useId();
  const ghiChuId = useId();
  const anh = useImageUpload({
    bookId,
    announce,
    onInsert: (attrs) => {
      if (editorRef.current) insertMediaBlock(editorRef.current, { type: "anh", attrs });
    },
  });

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    if (!editor) return;
    const nghe = ({ transaction }: { transaction: Transaction }) => {
      if (transaction.docChanged || transaction.selectionSet) {
        announce(mediaAnnouncement(transaction.before, transaction.doc, editor.state.selection));
      }
    };
    editor.on("transaction", nghe);
    return () => {
      editor.off("transaction", nghe);
    };
  }, [editor, announce]);

  return (
    <>
      <Toolbar editor={editor}>
        {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- nhom nut trong thanh cong cu, khong phai o form; fieldset pha bo cuc flex cua thanh. */}
        <span className="thanh-dinh-dang__nhom" role="group" aria-label="Thêm vào trang">
          <button
            type="button"
            className="nut-dinh-dang nut-dinh-dang--co-hinh"
            aria-disabled={!mediaEnabled || anh.busy || undefined}
            aria-describedby={mediaEnabled ? undefined : ghiChuId}
            disabled={!editor}
            onClick={() => {
              if (mediaEnabled && !anh.busy) chonAnhRef.current?.click();
            }}
          >
            <IconAnh />Thêm ảnh
          </button>
          <button
            ref={nutGhiRef}
            type="button"
            className="nut-dinh-dang nut-dinh-dang--co-hinh"
            aria-disabled={!mediaEnabled || undefined}
            aria-expanded={mediaEnabled ? ghiMo : undefined}
            aria-controls={ghiMo ? hopGhiId : undefined}
            aria-describedby={mediaEnabled ? undefined : ghiChuId}
            disabled={!editor}
            onClick={() => {
              if (!mediaEnabled) return;
              // Hop dang mo thi chi dua focus ve hop, khong dong, de khong mat ban ghi.
              if (ghiMo) document.getElementById(hopGhiId)?.focus();
              else setGhiMo(true);
            }}
          >
            <IconMic />Ghi âm
          </button>
        </span>
        <input
          ref={chonAnhRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const tep = e.currentTarget.files?.[0];
            // Xoa lua chon de chon lai dung tep do (vd sau loi tai len) van phat su kien change.
            e.currentTarget.value = "";
            if (tep) void anh.pick(tep);
          }}
        />
        {extra}
        {!mediaEnabled && <p className="thanh-dinh-dang__ghi" id={ghiChuId}>Chưa bật kho lưu ảnh và ghi âm.</p>}
      </Toolbar>
      {(anh.state.kind !== "nghi" || ghiMo) && (
        <div className="viet-phu">
          <ImageUploadLine state={anh.state} onPick={() => chonAnhRef.current?.click()} onRetry={anh.retry} onClose={anh.close} />
          {ghiMo && (
            <RecorderBox
              id={hopGhiId}
              bookId={bookId}
              author={author}
              onInsert={(attrs) => {
                if (editorRef.current) insertMediaBlock(editorRef.current, { type: "ghi-am", attrs });
                setGhiMo(false);
                announce(DA_CHEN_GHI_AM);
              }}
              onClose={() => {
                setGhiMo(false);
                nutGhiRef.current?.focus();
              }}
            />
          )}
        </div>
      )}
    </>
  );
}
