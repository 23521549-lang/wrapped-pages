"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useEditor } from "@tiptap/react";
import type { Editor as TiptapEditor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { actionSaveDraft } from "@/app/actions/library";
import { IconAnh, IconMic } from "@/components/media/icons";
import { paginate } from "@/lib/paginate";
import { CONTENT_HEIGHT } from "@/lib/sheet";
import { charCountLabel } from "@/lib/doc/counter";
import { toPlainJson } from "@/lib/doc/plain";
import { trimTrailingBlank } from "@/lib/doc/text";
import type { DocJson } from "@/lib/doc/types";
import { createAutosave, type SaveStatus } from "./autosave";
import { editorExtensions } from "./extensions";
import { FocusMode } from "./focusMode";
import { ImageUploadLine } from "./ImageUploadLine";
import { insertMediaBlock } from "./insertMedia";
import { measureUnits } from "./measure";
import { DA_CHEN_GHI_AM, mediaAnnouncement } from "./mediaAnnounce";
import { NONCE_TAI_LIEU } from "./nonce";
import { PageBreaks } from "./pageBreaks";
import { PagedSurface } from "./PagedSurface";
import { PublishBar } from "./PublishBar";
import { RecorderBox } from "./RecorderBox";
import { SaveBadge } from "./SaveBadge";
import { splitDoc } from "./split";
import { Toolbar } from "./Toolbar";
import { useImageUpload } from "./useImageUpload";
import { usePagedLayout } from "./usePagedLayout";

export type EditorProps = {
  bookId: string;
  bookTitle: string;
  /** Biet danh nguoi kia khi sach chia se, null khi rieng tu. */
  partnerNickname: string | null;
  initialDoc: DocJson;
  initialSavedAt: string | null;
  /** Biet danh nguoi viet (chu sach): chu thay the va nhan cua khoi media. */
  author: string;
  /** Kho media dang bat. Tat thi Them anh va Ghi am mo di, van Tab toi duoc, kem mot cau ghi chu. */
  mediaEnabled: boolean;
};

type Snapshot = { doc: unknown; sheets: number };

const KHOA_TAP_TRUNG = "mqce-tap-trung";

export function Editor({ bookId, bookTitle, partnerNickname, initialDoc, initialSavedAt, author, mediaEnabled }: EditorProps) {
  const [status, setStatus] = useState<SaveStatus | null>(
    initialSavedAt ? { kind: "da-luu", at: initialSavedAt } : null,
  );
  const [focus, setFocus] = useState(true);
  const editorRef = useRef<TiptapEditor | null>(null);
  const sheetCountRef = useRef(1);
  const mirrorRef = useRef<HTMLDivElement>(null);

  const autosave = useMemo(
    () =>
      // oxlint-disable-next-line react/refs -- FALSE POSITIVE: `editorRef.current` chi duoc doc ben trong `take`, mot closure ma autosave chi goi luc autosave.take() thuc su chay (khi luu), khong phai luc useMemo nay dang tinh gia tri (luc render).
      createAutosave<Snapshot>({
        save: (s) => actionSaveDraft(bookId, s.doc, s.sheets),
        // toPlainJson: attrs cua khoi media trong getJSON() khong co prototype (xem src/lib/doc/plain.ts),
        // phai ep ve JSON thuan truoc khi roi trinh duyet di toi actionSaveDraft (Server Action).
        take: () => (editorRef.current ? { doc: toPlainJson(editorRef.current.getJSON()), sheets: sheetCountRef.current } : null),
        onStatus: setStatus,
      }),
    [bookId],
  );

  // Giu nguyen tham chieu giua cac lan render: useEditor so extensions theo tham chieu, mang moi thi goi setOptions moi lan.
  const extensions = useMemo(() => [...editorExtensions(author), PageBreaks, FocusMode], [author]);
  const editor = useEditor({
    extensions,
    content: initialDoc,
    immediatelyRender: false,
    // TipTap chen mot the <style> luc chay (white-space: pre-wrap cua .ProseMirror, con tro gap...). Duoi CSP
    // ban phat hanh the do bi chan neu khong mang nonce cua tai lieu, va man viet mat het cach xuong dong. Luc
    // phat trien style-src la 'unsafe-inline' khong nonce (src/lib/csp.ts), nonce nay vo hai nhung khong can.
    injectNonce: NONCE_TAI_LIEU,
    editorProps: { attributes: { class: "giay-noi-dung", "aria-label": "Trang đang viết" } },
    onUpdate: () => autosave.changed(),
  });
  const { sheetCount, chars } = usePagedLayout(editor, mirrorRef);
  const dem = charCountLabel(chars);
  // Vung doc chung cua man viet: chon, bo, chen khoi media va tien trinh tai anh.
  const [loiDoc, setLoiDoc] = useState("");
  const [ghiMo, setGhiMo] = useState(false);
  const chonAnhRef = useRef<HTMLInputElement>(null);
  const nutGhiRef = useRef<HTMLButtonElement>(null);
  const hopGhiId = useId();
  const ghiChuId = useId();
  const anh = useImageUpload({
    bookId,
    announce: setLoiDoc,
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
        setLoiDoc(mediaAnnouncement(transaction.before, transaction.doc, editor.state.selection));
      }
    };
    editor.on("transaction", nghe);
    return () => {
      editor.off("transaction", nghe);
    };
  }, [editor]);

  useEffect(() => {
    sheetCountRef.current = sheetCount;
  }, [sheetCount]);

  useEffect(() => {
    try {
      // oxlint-disable-next-line react/set-state-in-effect -- Dong bo voi he thong ngoai (localStorage): doc trang thai tap trung da luu tu lan truoc ngay sau khi mount, khong the doc luc render vi localStorage khong ton tai tren server.
      if (localStorage.getItem(KHOA_TAP_TRUNG) === "tat") setFocus(false);
    } catch {
      // Trinh duyet chan luu tru: giu mac dinh la bat.
    }
  }, []);

  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (autosave.isDirty()) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      // Link cua Next dieu huong phia client, khong phat beforeunload: luu not phan chua luu truoc khi go.
      // TipTap hoan destroy() bang setTimeout, nen luc nay editor van doc duoc (kiem trong node_modules).
      void autosave.flush();
      autosave.dispose();
    };
  }, [autosave]);

  function doiTapTrung() {
    setFocus((f) => {
      try {
        localStorage.setItem(KHOA_TAP_TRUNG, f ? "tat" : "bat");
      } catch {
        // Khong luu duoc thi thoi, chi mat lua chon o lan sau.
      }
      return !f;
    });
  }

  const prepare = useCallback((): { sheets: DocJson[] } | { error: string } => {
    const ed = editorRef.current;
    if (!ed || !mirrorRef.current) return { error: "Trang chưa sẵn sàng. Thử lại sau một giây." };
    const doc = ed.state.doc;
    let parts: DocJson[];
    try {
      // measureUnits (nhu splitDoc ben duoi) co the nem khi ban sao do lech so doan voi tai lieu - ca
      // hai deu phai nam trong cung khoi try nay, khong de mot cu nem thoat thang vao onClick.
      const units = measureUnits(mirrorRef.current, doc);
      const sheets = paginate(units, CONTENT_HEIGHT);
      parts = splitDoc(doc, sheets.slice(1).map((s) => units[s.from].pos));
    } catch {
      return { error: "Chưa cắt được trang. Thử sửa một chút rồi đăng lại." };
    }
    const kept = trimTrailingBlank(parts);
    return kept.length > 0 ? { sheets: kept } : { error: "Trang còn trống, chưa có gì để đăng." };
  }, []);

  // Khoa vung soan thao ngay khi PublishBar mo hop xac nhan, khong phai khi bam "Dang": tu luc do
  // nguoi dung khong the go them nua, nen cai ho thay trong hop chac chan la cai se duoc dang.
  const lockEditor = useCallback(() => {
    editorRef.current?.setEditable(false);
  }, []);

  // Huy xac nhan (hoac prepare() dau tien that bai nen hop khong mo duoc): tra lai sua duoc.
  const unlockEditor = useCallback(() => {
    editorRef.current?.setEditable(true);
  }, []);

  const beforePublish = useCallback(async () => {
    // Vung soan thao da bi khoa tu luc mo hop xac nhan (lockEditor); o day chi con luu lan cuoi.
    await autosave.flush();
    // Tat, KHONG chi dispose(): cleanup luc redirect thoat component se goi flush() mot lan nua, va
    // neu bo tu luu con song thi lan flush do ghi lai ban nhap vua dang len database. Dang thanh cong
    // thi afterFail khong bao gio duoc goi, nen khong co resume() nao lam song lai duong nay; dang
    // hong thi afterFail se resume() vi luc do tu luu tiep la dieu dung phai lam.
    autosave.stop();
  }, [autosave]);

  return (
    <div className={focus ? "viet tap-trung" : "viet"}>
      <div className="viet-tren">
        <header className="viet-dau">
          <Link className="nav__link" href={`/sach/${bookId}`}>Về sách</Link>
          <h1 className="viet-dau__ten d">{bookTitle}</h1>
          <div className="viet-dau__phai">
            <span className="luu">{sheetCount} trang</span>
            {dem.kind === "gan" && <span className="luu dem-chu">{dem.text}</span>}
            <SaveBadge
              status={status}
              warning={dem.kind === "tran" ? dem.text : null}
              onRetry={() => void autosave.flush()}
            />
            <PublishBar
              bookId={bookId}
              bookTitle={bookTitle}
              partnerNickname={partnerNickname}
              prepare={prepare}
              lock={lockEditor}
              unlock={unlockEditor}
              beforePublish={beforePublish}
              afterFail={() => {
                // Dang hong: nguoi dung con o lai trang nen tu luu phai chay lai that su, khong chi
                // bao dirty suong - mo khoa vung soan thao, mo lai bo tu luu, roi bao co thay doi
                // chua luu de hen gio duoc dat ngay, khong phai cho den phim go tiep theo.
                editorRef.current?.setEditable(true);
                autosave.resume();
                autosave.changed();
              }}
            />
          </div>
        </header>
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
          <button type="button" className="nut-dinh-dang nut-dinh-dang--chu" aria-pressed={focus} onClick={doiTapTrung}>
            Tập trung
          </button>
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
                  setLoiDoc(DA_CHEN_GHI_AM);
                }}
                onClose={() => {
                  setGhiMo(false);
                  nutGhiRef.current?.focus();
                }}
              />
            )}
          </div>
        )}
      </div>
      <PagedSurface editor={editor} sheetCount={sheetCount} mirrorRef={mirrorRef} />
      <p className="sr-only" aria-live="polite">{loiDoc}</p>
    </div>
  );
}
