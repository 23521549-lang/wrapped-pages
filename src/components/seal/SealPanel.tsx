"use client";

import { useId, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SheetText } from "@/components/reader/Flipbook";
import { useFitScale } from "@/components/sheet/useFitScale";
import type { DocJson } from "@/lib/doc/types";
import { pageRange, pageRangeTitle, panelOf } from "@/lib/seal/reader";
import type { ReaderSeal } from "@/lib/seal/types";
import { SHEET } from "@/lib/sheet";
import { momentLabel, openLabel } from "@/lib/when";
import { AnswerForm, answerNote } from "./AnswerForm";
import { Countdown } from "./Countdown";
import { GiftKeyForm } from "./GiftKeyForm";
import { KnockLog } from "./KnockLog";

export type SealPanelProps = {
  seal: ReaderSeal;
  bookId: string;
  /** Biet danh chu sach. */
  ownerName: string;
  /** Biet danh nguoi con lai, nguoi bi thu thach. */
  readerName: string;
  /** Gio may chu luc ve trang: moi chu co thoi gian tinh voi gio nay de ban ve may chu va trinh duyet trung nhau. */
  now: Date;
};

/**
 * Trang tra loi dung rieng trong khung, thu phong vua be rong khung (khong chen vao sach lat). author la
 * nguoi viet trang tra loi, tuc nguoi bi thu thach; trang tra loi khong co khoi media.
 */
function ReplySheet({ doc, author }: { doc: DocJson; author: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const k = useFitScale(ref, SHEET.width, 1);
  return (
    <div ref={ref} className="to-rieng">
      <div className="khung-to" style={{ "--k": k } as CSSProperties}>
        <article className="to-giay" aria-label="Trang trả lời">
          <SheetText doc={doc} author={author} />
        </article>
      </div>
    </div>
  );
}

/**
 * Phan tra loi cua khung cau do. AnswerForm gan lai moi khi bat dau hay het khoang cho (key); vung thong bao
 * cho trinh doc man hinh nam ngoai key nen dung yen, chi doi chu. Chu ban dau tinh san tu props, nen luc mo
 * trang khong co gi duoc doc len.
 */
function RiddleAnswer({ seal, now }: { seal: ReaderSeal; now: Date }) {
  const [note, setNote] = useState(() => answerNote(seal, now, null));
  return (
    <>
      <AnswerForm key={seal.lockedUntil?.getTime() ?? "mo"} seal={seal} now={now} onNote={setNote} />
      <output className="sr-only">{note}</output>
    </>
  );
}

/** Khung thu thach duoi sach cho mot niem phong. Loai khung do panelOf quyet. */
export function SealPanel({ seal, bookId, ownerName, readerName, now }: SealPanelProps) {
  const id = useId();
  const router = useRouter();
  const kind = panelOf(seal);
  if (kind === null) return null;

  const range = pageRange(seal.firstPosition, seal.lastPosition);
  const dau = (tieuDe: string, ghi: string) => (
    <div className="thu-thach__dau">
      <h2 className="d" id={id}>{tieuDe}</h2>
      <p className="meta">{ghi}</p>
    </div>
  );
  const hoi = (ai: string) => (
    <div className="cau-hoi">
      <p className="cau-hoi__ai">{ai}</p>
      <p className="cau-hoi__chu">{seal.question}</p>
    </div>
  );
  const loiNhan = (ai: string) =>
    seal.giftNote !== null && (
      <div className="loi-nhan">
        <p className="loi-nhan__ai">{ai}</p>
        <p className="loi-nhan__chu">{seal.giftNote}</p>
      </div>
    );

  let body: ReactNode;
  if (kind === "cau-do") {
    body = (
      <>
        {dau("Câu đố", `${ownerName} đóng ${range} bằng một câu đố.`)}
        {hoi(`${ownerName} hỏi`)}
        <RiddleAnswer seal={seal} now={now} />
      </>
    );
  } else if (kind === "trao-doi") {
    body = (
      <>
        {dau("Trao đổi", `${ownerName} đóng ${range} bằng một câu hỏi.`)}
        {hoi(`${ownerName} hỏi`)}
        <p className="con-lan">Viết một trang trả lời thì cả hai trang cùng mở cho cả hai người.</p>
        <div className="thu-thach__nut">
          <Link className="btn" href={`/sach/${bookId}/tra-loi/${seal.id}`}>Viết trang trả lời</Link>
        </div>
      </>
    );
  } else if (kind === "hen-gio") {
    body = (
      <>
        {dau("Hẹn giờ", `${seal.mine ? "Bạn" : ownerName} hẹn ngày mở cho ${range}.`)}
        {seal.opensAt && (
          <>
            <Countdown opensAt={seal.opensAt} now={now} onDone={() => router.refresh()} />
            <p className="con-lan">{openLabel(seal.opensAt)}</p>
          </>
        )}
        {seal.mine && <p className="meta">Chính bạn cũng không mở sớm được.</p>}
      </>
    );
  } else if (kind === "cua-toi") {
    const phan = [pageRangeTitle(seal.firstPosition, seal.lastPosition)];
    if (seal.kind === "cau-do") phan.push(`${seal.answerCount ?? 0} đáp án`, `${seal.hints.length} gợi ý`);
    phan.push(seal.openedAt ? `${readerName} đã mở, ${momentLabel(seal.openedAt, now)}` : `${readerName} chưa mở được`);
    body = (
      <>
        {dau(seal.kind === "cau-do" ? "Câu đố của bạn" : "Trao đổi của bạn", phan.join(" · "))}
        {hoi("Bạn hỏi")}
        {loiNhan("Lời nhắn của bạn")}
        {seal.kind === "cau-do" && <KnockLog knocks={seal.knocks} partner={readerName} now={now} />}
        {seal.openedAt === null && <GiftKeyForm sealId={seal.id} partner={readerName} range={range} />}
      </>
    );
  } else if (kind === "trang-tra-loi") {
    body = (
      <>
        {dau("Trang trả lời", `${seal.mine ? readerName : "Bạn"} viết trang này để mở ${range}.`)}
        {hoi(seal.mine ? "Bạn hỏi" : `${ownerName} hỏi`)}
        {seal.reply && <ReplySheet doc={seal.reply} author={readerName} />}
      </>
    );
  } else {
    // "tang-khoa": panelOf chi tra loai nay khi nguoi kia da mo, nen openedAt luon co; thu hep kieu mot lan.
    if (seal.openedAt === null) return null;
    body = (
      <>
        {dau("Được tặng chìa khóa", `${ownerName} mở ${range} cho bạn, ${momentLabel(seal.openedAt, now)}.`)}
        {loiNhan(`Lời nhắn của ${ownerName}`)}
      </>
    );
  }

  return <section className="thu-thach" aria-labelledby={id}>{body}</section>;
}
