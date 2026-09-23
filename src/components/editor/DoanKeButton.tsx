"use client";

import { useEditorState } from "@tiptap/react";
import type { Editor } from "@tiptap/core";
import { chonDuocDoanKe, dangTrongDoanKe, doiDoanKe } from "./doanKe";

const CHON = "Chọn làm đoạn trên kệ";
const BO = "Bỏ đoạn trên kệ";

/** Dai danh dau ket vao trang sach. Chi ve, nghia nam o chu di kem. */
function IconDai() {
  return (
    <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
      <path d="M6 3h8v14l-4-3.2L6 17Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

/**
 * Nut chon doan se hien tren khung sach o Ke sach. Boi den mot cau roi bam; dang dung trong doan da chon thi nut doi
 * thanh "Bo doan tren ke" va bam la bo. Chua boi den gi ma cung khong dung trong doan nao thi nut mo di
 * (aria-disabled, van Tab toi duoc va van doc duoc) chu khong bien mat: thanh cong cu khong nhay cho.
 * Moi tai lieu chi co mot doan, nen chon lai la thay cho cu (xem datDoanKeTr).
 */
export function DoanKeButton({ editor, announce }: { editor: Editor | null; announce: (message: string) => void }) {
  const trangThai = useEditorState({
    editor,
    selector: ({ editor: e }) => (e ? { trong: dangTrongDoanKe(e.state), chon: chonDuocDoanKe(e.state) } : null),
  });
  const trong = trangThai?.trong ?? false;
  const lam = trong || (trangThai?.chon ?? false);
  return (
    <button
      type="button"
      className="nut-dinh-dang nut-dinh-dang--co-hinh"
      aria-pressed={trong}
      aria-disabled={lam ? undefined : true}
      disabled={!editor}
      onClick={() => {
        if (!editor || !lam) return;
        doiDoanKe(editor);
        announce(trong ? "Đã bỏ đoạn trên kệ." : "Đã chọn đoạn trên kệ.");
      }}
    >
      <IconDai />{trong ? BO : CHON}
    </button>
  );
}
