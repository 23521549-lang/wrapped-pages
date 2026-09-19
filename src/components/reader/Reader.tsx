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

/** Dung lat bao lau thi moi gui moc, de lat nhanh qua nhieu to chi gui mot lan. */
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
  /** Moc da doc luc mo man; chi gui khi to xa nhat vuot moc nay. */
  mark: number;
  /** Chi sach cua nguoi kia moi day moc (chu sach khong co moc). */
  trackRead: boolean;
  /** Nguoi xem la chu sach: to niem phong co dong "khong sua duoc" thay cho nut sua. */
  mine: boolean;
  /** Lan sua gan nhat cua tung to, cung thu tu voi sheets. */
  editedAt: readonly (Date | null)[];
  /** To nao chu sach sua duoc, cung thu tu voi sheets. Nguoi kia toan false nen ma ve nut khong chay. */
  editable: readonly boolean[];
};

/** Nghi thuc mo cua man doc nay: niem phong nao, va chu con dang hien dan tren to dau cua no khong. */
type NghiThuc = { sealId: string; dangGo: boolean };

/** Man doc phia trinh duyet: sach lat duoc, to niem phong, nghi thuc mo, khung thu thach, day moc da doc cua nguoi kia. */
export function Reader({
  bookId, title, sheets, looks, seals, ownerName, readerName, now, start, revealAt, mark, trackRead, mine, editedAt, editable,
}: ReaderProps) {
  const router = useRouter();
  const moId = useId();
  const best = useRef(mark);
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflight = useRef<Promise<void> | null>(null);
  const [shown, setShown] = useState({ first: start + 1, last: start + 1 });
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
    const position = pending.current;
    pending.current = null;
    if (position === null) return;
    inflight.current = actionMarkRead(bookId, position).catch(() => {});
  }, [bookId]);

  const onReach = useCallback(
    (position: number) => {
      if (!trackRead || position <= best.current) return;
      best.current = position;
      pending.current = position;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, CHO_MS);
    },
    [trackRead, flush],
  );

  const onShow = useCallback(
    (first: number, last: number) => {
      setShown((old) => (old.first === first && old.last === last ? old : { first, last }));
      // Khung dung yen ma khong con to dang go thi thoi: quay lai thi to do hien thang, khong go lai tu dau.
      if (moIndex !== null && (moIndex + 1 < first || moIndex + 1 > last)) stopReveal();
    },
    [moIndex, stopReveal],
  );

  useEffect(
    () => () => {
      // Roi man doc: gui ngay moc con dang hen, DOI lenh ghi moc gan nhat xong roi moi lam moi trang vua toi.
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
            return (
              <li key={i ?? `trong-${k}`}>
                {sua && (
                  <p className="trang-ghi__sua"><time dateTime={sua.toISOString()}>{editedLabel(sua, now)}</time></p>
                )}
                {i !== null && mine && editable[i] && (
                  <Link className="btn btn--chu" href={`/sach/${bookId}/sua-trang/${i + 1}`}>Sửa trang {i + 1}</Link>
                )}
                {i !== null && mine && !editable[i] && (
                  <p className="trang-ghi__khoa"><GlyphKhoa />Trang niêm phong không sửa được</p>
                )}
              </li>
            );
          })}
        </ul>
      );
    },
    [bookId, editedAt, editable, mine, now],
  );

  const moSeal = nghiThuc === null ? undefined : seals.find((s) => s.id === nghiThuc.sealId);
  const moRange = moSeal ? pageRangeTitle(moSeal.firstPosition, moSeal.lastPosition) : "";

  return (
    <>
      <Flipbook title={title} sheets={sheets} author={ownerName} start={start} onReach={onReach} renderSheet={renderSheet} onShow={onShow} renderFoot={renderFoot} />
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
