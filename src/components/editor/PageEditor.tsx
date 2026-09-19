"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import Link from "next/link";
import { unstable_rethrow, useRouter } from "next/navigation";
import { useEditor } from "@tiptap/react";
import type { Editor as TiptapEditor, JSONContent } from "@tiptap/core";
import { actionEditPage } from "@/app/actions/library";
import { TRANG_VUA_SUA_NOI_KHAC } from "@/app/actions/messages";
import { normalizeContinuation } from "@/lib/doc/continuation";
import { toPlainJson } from "@/lib/doc/plain";
import { docCharCount, isBlankDoc } from "@/lib/doc/text";
import type { DocJson } from "@/lib/doc/types";
import { checkDraftInput, EDIT_SHEET_MAX_CHARS } from "@/lib/doc/validate";
import { SHEET } from "@/lib/sheet";
import { dateLabel, timeAgo } from "@/lib/when";
import { pageEditExtensions } from "./extensions";
import { MediaTools } from "./MediaTools";
import { NONCE_TAI_LIEU } from "./nonce";
import { PagedSurface } from "./PagedSurface";
import { droppedMedia, fromEditorDoc, pageEditKey, pageEditTemp, readPageEditTemp, staleTempKeys, toEditorDoc } from "./pageEdit";
import { measureOneSheet, useOneSheet } from "./useOneSheet";

export type PageEditorProps = {
  bookId: string;
  bookTitle: string;
  /** Vi tri to dang sua, tu 1. */
  position: number;
  /** Noi dung to nhu da dang. */
  initialDoc: DocJson;
  /** Moc phien ban (lan sua gan nhat, hay luc dang) dang ISO, gui lai nguyen van khi luu. */
  version: string;
  publishedAt: string;
  editedAt: string | null;
  /** Gio may chu luc ve trang, de dong phu ra cung chu o may chu va trinh duyet. */
  now: string;
  /** Biet danh chu sach: chu thay the va nhan cua khoi media. */
  author: string;
  mediaEnabled: boolean;
};

/**
 * Hop xac nhan dang mo: bo thay doi de roi man (tu nut "Huy", hay tu lien ket "Ve sach"), hay bo thay doi de tai ban moi
 * sau khi to vua duoc sua noi khac. Moi loai tra focus ve dung cho da mo hop.
 */
type Hoi = "huy" | "ve-sach" | "tai-lai";

const CAU_HOI = "Bỏ các thay đổi trên trang này?";
const LOI = {
  tran: "Đã tràn khỏi trang, cần gọn lại.",
  dai: "Trang dài quá một trang.",
  hong: "Trang có nội dung không đọc được.",
  trong: "Trang không được để trống.",
  chuaDo: "Chưa đo được trang. Thử lại sau một giây.",
  mang: "Chưa lưu được. Kiểm tra mạng rồi thử lại.",
} as const;

function luuTam(khoa: string, version: string, doc: JSONContent): void {
  try {
    sessionStorage.setItem(khoa, pageEditTemp(version, doc, Date.now()));
  } catch {
    // Trinh duyet chan luu tru: chi mat lop chong mat chu nay, van sua va luu duoc.
  }
}

function xoaTam(khoa: string): void {
  try {
    sessionStorage.removeItem(khoa);
  } catch {
    // Khong xoa duoc thi thoi: ban tam chi khoi phuc khi moc phien ban con trung.
  }
}

/** Xoa ban tam cu cua cac to khac cung cuon (xem staleTempKeys). */
function donTamCu(bookId: string, position: number): void {
  try {
    const cap: [string, string | null][] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k !== null) cap.push([k, sessionStorage.getItem(k)]);
    }
    for (const k of staleTempKeys(cap, bookId, position, Date.now())) sessionStorage.removeItem(k);
  } catch {
    // Trinh duyet chan luu tru: khong co gi de don.
  }
}

/**
 * Man sua mot to da dang: dung mot to giay cung kho, do tran bang dung ham cua trang tra loi (useOneSheet, paginate), nen
 * to luu xong vua mot to va man doc ngat trang y nhu truoc. Khong tu luu len may chu: chi "Luu thay doi" moi gui. Chong
 * mat chu bang ban tam trong sessionStorage (chi khoi phuc khi moc phien ban con trung) va canh bao beforeunload.
 */
export function PageEditor({
  bookId, bookTitle, position, initialDoc, version, publishedAt, editedAt, now, author, mediaEnabled,
}: PageEditorProps) {
  const router = useRouter();
  const khoa = pageEditKey(bookId, position);
  const veSach = `/sach/${bookId}?trang=${position}`;
  const [error, setError] = useState<string | null>(null);
  const [hoi, setHoi] = useState<Hoi | null>(null);
  const [khoiPhuc, setKhoiPhuc] = useState(false);
  const [boMedia, setBoMedia] = useState(false);
  const [loiDoc, setLoiDoc] = useState("");
  const [pending, startTransition] = useTransition();
  // Anh dang xu ly, tai len hay hop ghi am dang mo: chua chen xong, nen chua cho luu (khoi media khong roi vao giua luc luu).
  const [mediaBan, setMediaBan] = useState(false);
  const mirrorRef = useRef<HTMLDivElement>(null);
  // Mot "chua doi gi": JSON cua trinh soan thao ngay sau khi tao, truoc khi khoi phuc ban tam.
  const gocRef = useRef<string | null>(null);
  // Da gui action: roi trang luc nay (redirect) khong phai mat chu.
  const daGuiRef = useRef(false);
  const nutHuyRef = useRef<HTMLButtonElement>(null);
  const veSachRef = useRef<HTMLAnchorElement>(null);
  const nutTaiLaiRef = useRef<HTMLButtonElement>(null);
  const suaTiepRef = useRef<HTMLButtonElement>(null);

  const extensions = useMemo(() => pageEditExtensions(author), [author]);
  const content = useMemo(() => toEditorDoc(initialDoc), [initialDoc]);
  const editor = useEditor({
    extensions,
    content,
    immediatelyRender: false,
    // Nhu Editor.tsx: the <style> TipTap chen luc chay phai mang nonce cua tai lieu, khong thi CSP chan.
    injectNonce: NONCE_TAI_LIEU,
    editorProps: {
      attributes: { class: "giay-noi-dung", "aria-label": "Trang đang sửa", "aria-describedby": "vua-trang" },
    },
    onCreate: ({ editor: ed }) => {
      gocRef.current = JSON.stringify(ed.getJSON());
      let raw: string | null = null;
      try {
        raw = sessionStorage.getItem(khoa);
      } catch {
        // Trinh duyet chan luu tru: bat dau tu ban da dang.
      }
      donTamCu(bookId, position);
      const tam = readPageEditTemp(raw, version);
      if (tam) {
        // Khoi phuc ngoai lich su hoan tac: Ctrl+Z ngay sau do khong duoc xoa chu vua khoi phuc.
        ed.chain().setMeta("addToHistory", false).setContent(tam).run();
        const khac = JSON.stringify(ed.getJSON()) !== gocRef.current;
        setKhoiPhuc(khac);
        if (!khac) xoaTam(khoa);
      } else if (raw !== null) {
        // Ban tam cua phien ban cu (to vua duoc sua o noi khac) hay hong: khong bao gio dung toi nua.
        xoaTam(khoa);
      }
      ed.commands.focus("end");
    },
    onUpdate: ({ editor: ed }) => {
      const json = ed.getJSON();
      if (JSON.stringify(json) === gocRef.current) xoaTam(khoa);
      else luuTam(khoa, version, toPlainJson(json));
      setBoMedia(droppedMedia(initialDoc, json));
    },
  });
  const fit = useOneSheet(editor, mirrorRef);
  const cao = Math.max(SHEET.height, SHEET.padTop + fit.contentHeight + SHEET.padBottom);

  const daDoi = useCallback((ed: TiptapEditor) => gocRef.current !== null && JSON.stringify(ed.getJSON()) !== gocRef.current, []);

  useEffect(() => {
    if (!editor) return;
    const onLeave = (e: BeforeUnloadEvent) => {
      if (editor.isDestroyed || daGuiRef.current) return;
      if (daDoi(editor)) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, [editor, daDoi]);

  useEffect(() => {
    if (hoi) suaTiepRef.current?.focus();
  }, [hoi]);

  /** Kiem dung nhu actionEditPage, roi do mot to. Tra tai lieu da lam sach de gui, hoac loi. */
  function kiem(ed: TiptapEditor): { doc: DocJson } | { error: string } {
    const checked = checkDraftInput(fromEditorDoc(ed.getJSON()));
    if (!checked.ok) return { error: checked.reason === "too-long" ? LOI.dai : LOI.hong };
    if (docCharCount(checked.doc) > EDIT_SHEET_MAX_CHARS) return { error: LOI.dai };
    if (isBlankDoc(checked.doc)) return { error: LOI.trong };
    if (!mirrorRef.current) return { error: LOI.chuaDo };
    try {
      if (measureOneSheet(ed, mirrorRef.current).overflow) return { error: LOI.tran };
    } catch {
      return { error: LOI.chuaDo };
    }
    return { doc: normalizeContinuation(checked.doc) };
  }

  function luu() {
    const ed = editor;
    if (!ed) return;
    // Khoa TRUOC khi kiem: cai duoc gui chac chan la cai dang hien tren to (nhu PublishBar).
    ed.setEditable(false, false);
    if (!daDoi(ed)) {
      xoaTam(khoa);
      router.push(veSach);
      return;
    }
    const r = kiem(ed);
    if ("error" in r) {
      setError(r.error);
      ed.setEditable(true, false);
      return;
    }
    setError(null);
    const draft = toPlainJson(ed.getJSON());
    // Hong thi ghi lai ban tam, hien loi, mo khoa: chu van con de sua tiep hay luu lai.
    const hong = (loi: string) => {
      daGuiRef.current = false;
      luuTam(khoa, version, draft);
      setError(loi);
      ed.setEditable(true, false);
    };
    startTransition(async () => {
      try {
        daGuiRef.current = true;
        xoaTam(khoa);
        const res = await actionEditPage(bookId, position, toPlainJson(r.doc), version);
        if (res?.error) hong(res.error);
      } catch (err) {
        // Luu thanh cong thi redirect() ben trong action nem loi dieu huong dac biet: phai de no di tiep cho Next.
        unstable_rethrow(err);
        hong(LOI.mang);
      }
    });
  }

  function huy() {
    if (editor && daDoi(editor)) setHoi("huy");
    else router.push(veSach);
  }

  /** Dong hop xac nhan, tra focus ve dung nut da mo no. */
  function dongHoi() {
    const moTu = hoi === "tai-lai" ? nutTaiLaiRef : hoi === "ve-sach" ? veSachRef : nutHuyRef;
    flushSync(() => setHoi(null));
    moTu.current?.focus();
  }

  function boThayDoi() {
    xoaTam(khoa);
    if (hoi === "tai-lai") {
      setHoi(null);
      // key={version} o trang: lam moi xong thi trinh soan thao dung lai tu ban moi nhat.
      router.refresh();
      return;
    }
    daGuiRef.current = true;
    router.push(veSach);
  }

  function dungBanDaDang() {
    if (!editor) return;
    editor.chain().setMeta("addToHistory", false).setContent(content, { emitUpdate: false }).run();
    xoaTam(khoa);
    setKhoiPhuc(false);
    setBoMedia(false);
  }

  const bayGio = new Date(now);
  const phu = `${bookTitle}, đăng ${dateLabel(new Date(publishedAt), bayGio)}${editedAt ? `, đã sửa ${timeAgo(new Date(editedAt), bayGio)}` : ""}`;

  return (
    <div className="viet">
      <div className="viet-tren">
        <header className="viet-dau">
          <Link
            ref={veSachRef}
            className="nav__link"
            href={veSach}
            onClick={(e) => {
              // Nhu nut "Huy": dang luu thi dung yen (luu xong tu ve sach), da doi thi hoi truoc. Lien ket noi bo cua Next
              // khong phat beforeunload, nen khong co lop chan nao khac.
              if (pending) e.preventDefault();
              else if (editor && daDoi(editor)) {
                e.preventDefault();
                setHoi("ve-sach");
              }
            }}
          >
            Về sách
          </Link>
          <h1 className="viet-dau__ten d">Sửa trang {position}</h1>
          <p className="meta">{phu}</p>
          <div className="viet-dau__phai">
            {/* output mang san vai status: doi Vua mot trang / Da tran thi trinh doc man hinh doc lai. */}
            <output id="vua-trang" className={fit.overflow ? "vua-trang vua-trang--tran" : "vua-trang"}>
              {fit.overflow ? (
                <>
                  <span className="dau-loi" aria-hidden="true">!</span>Đã tràn khỏi trang, cần gọn lại
                </>
              ) : (
                "Vừa một trang"
              )}
            </output>
            {hoi ? (
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- Esc bat tren ca nhom de dong hop du focus dang o nut nao trong hop.
              <div
                className="dang-hoi"
                // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- hop xac nhan noi tuyen chi co hai nut, khong phai o nhap cua form; cung ly do voi PublishBar.
                role="group"
                aria-label={CAU_HOI}
                onKeyDown={(e) => {
                  if (e.key !== "Escape") return;
                  e.preventDefault();
                  dongHoi();
                }}
              >
                <p className="dang-hoi__chu"><b>{CAU_HOI}</b></p>
                <div className="dang-hoi__nut">
                  <button ref={suaTiepRef} type="button" className="btn" onClick={dongHoi}>Sửa tiếp</button>
                  <button type="button" className="btn btn--line" onClick={boThayDoi}>
                    {hoi === "tai-lai" ? "Tải bản mới" : "Bỏ thay đổi"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="dang">
                <button type="button" className="btn" disabled={fit.overflow || pending || mediaBan} aria-busy={pending || undefined} onClick={luu}>
                  Lưu thay đổi
                </button>
                <button ref={nutHuyRef} type="button" className="btn btn--line" disabled={pending} onClick={huy}>Hủy</button>
                {error && <p className="luu luu--loi" role="alert">{error}</p>}
                {error === TRANG_VUA_SUA_NOI_KHAC && (
                  <button ref={nutTaiLaiRef} type="button" className="btn btn--chu" onClick={() => setHoi("tai-lai")}>Tải lại</button>
                )}
              </div>
            )}
          </div>
        </header>
        <MediaTools
          editor={editor}
          bookId={bookId}
          author={author}
          mediaEnabled={mediaEnabled}
          announce={setLoiDoc}
          locked={pending}
          onBusyChange={setMediaBan}
        />
      </div>

      <div className="sua-ghi" aria-live="polite">
        {khoiPhuc && (
          <p className="sua-ghi__dong">
            <span>Đã khôi phục chữ đang sửa dở.</span>
            <button type="button" className="btn btn--chu" onClick={dungBanDaDang}>Dùng bản đã đăng</button>
          </p>
        )}
        {boMedia && <p className="field__help">Ảnh hoặc ghi âm bỏ khỏi trang sẽ bị xóa hẳn sau khi lưu.</p>}
      </div>

      <PagedSurface editor={editor} sheetCount={1} mirrorRef={mirrorRef} height={cao} numbered={false}>
        <div className="het-cho" data-hien={fit.overflow ? "co" : undefined} aria-hidden="true"><span>Hết trang</span></div>
      </PagedSurface>
      <p className="sr-only" aria-live="polite">{loiDoc}</p>
    </div>
  );
}
