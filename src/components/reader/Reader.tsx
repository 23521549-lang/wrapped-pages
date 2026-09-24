"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { actionMarkRead } from "@/app/actions/library";
import { GlyphKhoa } from "@/components/book/ShelfBook";
import { SealPanel } from "@/components/seal/SealPanel";
import { TypeReveal } from "@/components/seal/TypeReveal";
import { ClockSkew, useClockSkew } from "@/components/seal/useTimeLeft";
import type { DocJson } from "@/lib/doc/types";
import { pageRangeTitle, ritualKey, sealsInView, type RevealTarget, type SheetLook } from "@/lib/seal/reader";
import type { ReaderSeal } from "@/lib/seal/types";
import { editedLabel } from "@/lib/when";
import { Flipbook, SheetText } from "./Flipbook";
import { LockedSheet, SealMark } from "./LockedSheet";
import { useShownSheets } from "./ShownSheets";

/** Dung lat bao lau thi moi gui khung dang hien, de lat nhanh qua nhieu to chi gui khung dung lai that su. */
const CHO_MS = 600;

export type ReaderProps = {
  bookId: string;
  title: string;
  sheets: DocJson[];
  /** Cach ve tung to (sheetLooks), cung thu tu voi sheets. */
  looks: SheetLook[];
  /** Niem phong cua cuon, da duoc may chu loc cho nguoi xem. */
  seals: ReaderSeal[];
  /** Biet danh chu sach. */
  ownerName: string;
  /** Biet danh nguoi con lai. */
  readerName: string;
  /** Gio may chu luc ve trang. */
  now: Date;
  start: number;
  /** Noi chay nghi thuc mo (revealTarget: may chu tra ritual true cho niem phong trong ?mo=): chi so to va ma niem phong, hoac null. */
  revealAt: RevealTarget | null;
  /** Vi tri cac to nguoi xem da tung thay, de khong gui lai mot khung da ghi. */
  seen: readonly number[];
  /** Chi sach cua nguoi kia moi ghi to da xem (chu sach khong co dong nao). */
  trackRead: boolean;
  /** Nguoi xem la chu sach: to chua sua duoc co dong "Dang niem phong" thay cho nut sua. */
  mine: boolean;
  /** Lan sua gan nhat cua tung to, cung thu tu voi sheets. */
  editedAt: readonly (Date | null)[];
  /**
   * Duong dan man sua luot mo dung tung to, cung thu tu voi sheets. null: to chu sach chua sua duoc (luot con niem phong
   * voi nguoi kia), hay nguoi xem khong phai chu sach (khi do moi phan tu deu null va ma ve nut khong chay).
   */
  editHref: readonly (string | null)[];
};

/** Nghi thuc mo cua man doc nay: niem phong nao, va chu con dang hien dan tren to dau cua no khong. */
type NghiThuc = { sealId: string; dangGo: boolean };

/** Man doc phia trinh duyet: sach lat duoc, to niem phong, nghi thuc mo, khung thu thach, ghi cac to nguoi kia da thay. */
export function Reader({
  bookId, title, sheets, looks, seals, ownerName, readerName, now, start, revealAt, seen, trackRead, mine, editedAt, editHref,
}: ReaderProps) {
  const router = useRouter();
  const moId = useId();
  // Cac to da ghi (tu may chu, cong cac khung vua gui trong tab nay): khung nao cung da ghi thi khong goi nua.
  const daGui = useRef(new Set(seen));
  // Cac vi tri dang cho gui (cac to DANG MO cua khung dung yen gan nhat), hoac null khi khong co gi cho.
  const pending = useRef<number[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  // To dang hien song o ShownSheetsProvider (neu co) de cot phai cua man doc cung theo; khung thu thach van doc no.
  const { shown, setShown } = useShownSheets(start);
  // Lech dong ho do mot lan cho ca man doc: khung thu thach go ra gan lai khi lat trang van dem dung.
  const lech = useClockSkew(now);
  const [nghiThuc, setNghiThuc] = useState<NghiThuc | null>(null);
  // Tach revealAt thanh gia tri nguyen thuy: moi lan lam moi tu may chu la mot object moi, con hai gia tri nay giu nguyen.
  const moIndex = revealAt?.index ?? null;
  const moSealId = revealAt?.sealId ?? null;

  // Lop hai cua "mot lan" (lop mot la RITUAL_WINDOW_MS o may chu): moi niem phong chi chay nghi thuc mot lan trong
  // tab nay, nen tai lai hay lui toi trong lich su khi con trong 2 phut thi hien thang. Kiem va ghi sessionStorage
  // truoc lan ve dau sau hydrate, cung lan commit voi setMode cua Flipbook (khung sach con an toi luc do, chu khong
  // nhay). Strict Mode chay lai hieu ung thi thay khoa da co va dung, state van la nghi thuc. Khong xoa mo khoi URL.
  useLayoutEffect(() => {
    if (moSealId === null) return;
    const khoa = ritualKey(moSealId);
    try {
      if (sessionStorage.getItem(khoa) !== null) return;
      sessionStorage.setItem(khoa, "1");
    } catch {
      // Trinh duyet chan sessionStorage: van chay; may chu da chan tai lai muon va link cu bang RITUAL_WINDOW_MS.
    }
    // oxlint-disable-next-line react/set-state-in-effect -- Dong bo voi he thong ngoai (sessionStorage): chi biet nghi thuc da chay trong tab nay sau hydrate, luc render o may chu khong doc duoc.
    setNghiThuc({ sealId: moSealId, dangGo: true });
  }, [moSealId]);

  const stopReveal = useCallback(() => {
    setNghiThuc((x) => (x?.dangGo ? { ...x, dangGo: false } : x));
  }, []);
  const dangGo = nghiThuc?.dangGo === true;

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const khung = pending.current;
    pending.current = null;
    if (khung === null) return;
    // Chi cac to MAY CHU DA GHI moi duoc nho, va may chu noi ro chung la nhung to nao: markRead con loc them mot lan
    // nua (to vuot to cuoi, to vua bi khoa lai) nen "khong nem loi" khong co nghia la ca cum da vao bang.
    // Ghi luc vua hien thi to lat nhanh qua (khung bi khung sau de len, khong bao gio gui) hay lan gui hong (mat mang)
    // se bi coi la da ghi, quay lai doc that cung khong gui nua.
    // Hong thi im lang voi nguoi doc: mat vai to da xem khong dang mot loi tren man doc, va lan sau van gui lai duoc.
    inflight.current = actionMarkRead(bookId, khung).then(
      (daGhi) => {
        for (const p of daGhi) daGui.current.add(p);
      },
      () => {},
    );
  }, [bookId]);

  // To nao dang khoa, duoi dang chuoi "0"/"1" cung thu tu voi sheets. Day la mot gia tri NGUYEN THUY, nen onShow giu
  // nguyen danh tinh qua moi lan may chu lam moi (looks la mang moi o moi lan ve, con chuoi nay thi so bang gia tri).
  // Neu onShow doi danh tinh thi hieu ung cua Flipbook bao lai khung va dong ho cho CHO_MS gan lai tu dau: mot nhip
  // lam moi day hon CHO_MS se lam viec ghi to da xem tat lim ma khong bao mot loi nao.
  const khoaKey = looks.map((l) => (l.kind === "khoa" ? "1" : "0")).join("");

  const onShow = useCallback(
    (first: number, last: number) => {
      setShown({ first, last });
      if (trackRead) {
        // Chi to that su hien VA may chu chiu ghi moi duoc gui: to trong luot con niem phong voi nguoi xem bi markRead
        // loc bo im lang, nen bo khoi khung gui - de no khong bi nho nham la da ghi, va van duoc gui khi niem phong vua
        // mo ngay tai cho (khoaKey doi, man doc khong gan lai tu dau). Khung nao cung da ghi roi thi thoi: lat qua lat
        // lai khong goi lai may chu.
        // Gui DUNG cac vi tri nay, khong gui khoang [dau, cuoi] cua chung: mot to khoa nam giua hai to mo khong bao gio
        // lot vao lenh goi, va lenh goi khong phai dua vao viec khung chi co toi MAX_SHOWN_SHEETS to moi dung.
        const mo: number[] = [];
        for (let p = first; p <= last; p++) {
          if (khoaKey[p - 1] !== "1") mo.push(p);
        }
        // Mot khung moi hien ra la da ROI khung truoc: huy lenh ghi con dang hen cua khung do truoc khi hen lenh moi,
        // ke ca khi khung moi khong co gi de gui (moi to cua no deu khoa, hay deu da ghi). Khong huy thi dong ho cua
        // khung cu chay tiep tren khung moi, va mot khung nguoi doc chi luot qua van bi ghi la da doc.
        if (timer.current) clearTimeout(timer.current);
        timer.current = null;
        pending.current = null;
        if (mo.some((p) => !daGui.current.has(p))) {
          pending.current = mo;
          timer.current = setTimeout(flush, CHO_MS);
        }
      }
      // Khung dung yen ma khong con to dang go thi thoi: quay lai thi to do hien thang, khong go lai tu dau.
      if (moIndex !== null && (moIndex + 1 < first || moIndex + 1 > last)) stopReveal();
    },
    [moIndex, stopReveal, setShown, trackRead, flush, khoaKey],
  );

  useEffect(
    () => () => {
      // Roi man doc: gui ngay khung con dang hen, DOI lenh ghi gan nhat xong roi moi lam moi trang vua toi.
      // Khong dua vao thu tu hang doi cua router: bam quay lai (ACTION_RESTORE) go server action dang chay
      // khoi hang doi (app-router-instance.js, dispatchAction), refresh se chay song song voi no.
      flush();
      const p = inflight.current;
      if (p) void p.then(() => router.refresh());
    },
    [flush, router],
  );

  const renderSheet = useCallback(
    (i: number): ReactNode => {
      if (dangGo && i === moIndex) return <TypeReveal doc={sheets[i]} author={ownerName} onDone={stopReveal} />;
      const look = looks[i];
      if (look?.kind === "khoa") return <LockedSheet teaser={look.teaser} index={i} />;
      if (look?.kind === "dau") {
        return (
          <>
            <SealMark label={look.label} />
            <SheetText doc={sheets[i]} author={ownerName} />
          </>
        );
      }
      return undefined;
    },
    [looks, sheets, ownerName, dangGo, moIndex, stopReveal],
  );

  // Dai duoi cuon sach: "Da sua luc ..." cho ca hai nguoi, nut sua hay dong niem phong chi cho chu sach. Khong co gi
  // de hien thi khong ve dai. Vi tri to la chi so cong mot vi vi tri lien nhau tu 1.
  const renderFoot = useCallback(
    (dangHien: readonly (number | null)[]): ReactNode => {
      const coGi = dangHien.some((i) => i !== null && (editedAt[i] !== null || mine));
      if (!coGi) return null;
      return (
        <ul className="trang-ghi" aria-label="Ghi chú trang đang mở">
          {dangHien.map((i, k) => {
            const sua = i === null ? null : editedAt[i];
            const den = i === null ? null : editHref[i];
            return (
              <li key={i ?? `trong-${k}`}>
                {sua && (
                  <p className="trang-ghi__sua"><time dateTime={sua.toISOString()}>{editedLabel(sua, now)}</time></p>
                )}
                {i !== null && mine && den !== null && (
                  <Link className="btn btn--chu" href={den}>Sửa trang {i + 1}</Link>
                )}
                {i !== null && mine && den === null && (
                  <p className="trang-ghi__khoa"><GlyphKhoa />Đang niêm phong, chưa sửa được</p>
                )}
              </li>
            );
          })}
        </ul>
      );
    },
    [editedAt, editHref, mine, now],
  );

  const moSeal = nghiThuc === null ? undefined : seals.find((s) => s.id === nghiThuc.sealId);
  const moRange = moSeal ? pageRangeTitle(moSeal.firstPosition, moSeal.lastPosition) : "";

  return (
    <>
      <Flipbook title={title} sheets={sheets} author={ownerName} start={start} renderSheet={renderSheet} onShow={onShow} renderFoot={renderFoot} />
      {/* Vung live co mat tu lan ve dau, nen khung chen vao sau hydrate duoc trinh doc man hinh doc len. */}
      <div aria-live="polite">
        {moSeal && (
          <section className="thu-thach" aria-labelledby={moId}>
            <div className="thu-thach__dau">
              <h2 className="d" id={moId}>Đã mở trang</h2>
              <p className="meta">
                {moSeal.kind === "trao-doi"
                  ? `Bạn đã gửi trang trả lời. ${moRange} vừa mở cho cả hai người.`
                  : `Bạn trả lời đúng. ${moRange} vừa mở, ${ownerName} sẽ thấy trong nhật ký gõ cửa.`}
              </p>
            </div>
          </section>
        )}
      </div>
      <ClockSkew value={lech}>
        {sealsInView(seals, shown.first, shown.last).map((s) => (
          <SealPanel key={s.id} seal={s} bookId={bookId} ownerName={ownerName} readerName={readerName} now={now} />
        ))}
      </ClockSkew>
    </>
  );
}
