"use client";

import { useState, useTransition } from "react";
import { actionRemoveCoverEntry, actionSetCoverEntry } from "@/app/actions/library";
import { COVER_NAME, type CoverKey } from "@/lib/book";
import { cuoiCo, hienHanh } from "@/lib/dong-luot";
import { dateLabel } from "@/lib/when";
import type { CoverSlot } from "@/server/library/timeline";
import { CoverArt } from "./CoverArt";
import { CoverImage } from "./CoverImage";
import { CoverPicker, type CoverPhotoView, type CoverValue } from "./CoverPicker";
import { DongThoiGian, type MocDong } from "./DongThoiGian";

/** Bia rieng cua mot luot; null la luot giu bia cua luot truoc. */
type OBia = { cover: CoverKey; coverMediaId: string | null } | null;

const MAT_MANG = "Chưa lưu được. Kiểm tra mạng rồi thử lại.";

export type DongBiaProps = {
  bookId: string;
  /** Ca dong thoi gian bia, gom ca o trong cua luot chua dat bia. */
  slots: readonly CoverSlot[];
  /** Kho anh bia cua cuon, moi nhat truoc. */
  photos: readonly CoverPhotoView[];
  mediaEnabled: boolean;
  now: Date;
};

const tenBia = (b: NonNullable<OBia>) => (b.coverMediaId !== null ? "Ảnh của bạn" : COVER_NAME[b.cover]);
const tenLuot = (s: CoverSlot) => (s.ordinal === null ? "lúc tạo sách" : `lượt ${s.ordinal}`);
const giong = (a: OBia, b: OBia) => (a === null ? b === null : b !== null && a.cover === b.cover && a.coverMediaId === b.coverMediaId);

/** Bia nho cua mot moc: bia hien hanh cua luot, mo di khi luot giu bia truoc; chua co bia nao thi o vien dut. */
function BiaNho({ bia, giu }: { bia: OBia; giu: boolean }) {
  if (bia === null) return <span className="tg-dong__bia tg-dong__bia--trong" aria-hidden="true" />;
  return (
    <span className={`tg-dong__bia bia bia--${bia.cover}${giu ? " tg-dong__bia--giu" : ""}`} aria-hidden="true">
      <CoverArt cover={bia.cover} />
      <CoverImage mediaId={bia.coverMediaId} />
    </span>
  );
}

/** Bang bia rũ xuống duoi mot moc: bang cua CoverPicker, chon xong (hay tai anh xong) la luu. */
function ChonBia({ s, dau, photos, bookId, mediaEnabled, loi, dangLuu, onChon, onBan }: {
  s: CoverSlot; dau: boolean; photos: readonly CoverPhotoView[]; bookId: string; mediaEnabled: boolean; loi: string | null;
  dangLuu: boolean; onChon: (v: CoverValue) => void; onBan: (ban: boolean) => void;
}) {
  const [chon, setChon] = useState<CoverValue>({ cover: s.o?.cover ?? null, photoId: s.o?.coverMediaId ?? null });
  return (
    <>
      <CoverPicker
        value={chon}
        onChange={(doi) => {
          const moi = doi(chon);
          setChon(moi);
          onChon(moi);
        }}
        photos={photos}
        giuDuoc={!dau}
        nhanGiu="Giữ bìa trước"
        tron
        nhanDoc={`Bìa ${tenLuot(s)}`}
        bookId={bookId}
        mediaEnabled={mediaEnabled}
        disabled={dangLuu}
        onBusyChange={onBan}
      />
      {loi !== null && <p className="form__loi" role="alert">{loi}</p>}
    </>
  );
}

/**
 * Truong Bia cua man Sua sach (chu du an duyet 28/09): dong thoi gian bia theo tung luot dang, thu gon mac dinh. Moi luot
 * giu duoc mot bia rieng; luot khong dat thi giu bia truoc. Chon mot bia la ghi ngay mot o (actionSetCoverEntry, hay bo o
 * khi chon Giu bia truoc), roi bang chon cuon len; may chu van tu choi bo o bia cuoi cung. Hoan tac ghi lai gia tri cu.
 */
export function DongBia({ bookId, slots, photos, mediaEnabled, now }: DongBiaProps) {
  const os: OBia[] = slots.map((s) => (s.o === null ? null : { cover: s.o.cover, coverMediaId: s.o.coverMediaId }));
  const hien = hienHanh(os);
  const dung = cuoiCo(os);
  const [loi, setLoi] = useState<{ i: number; chu: string } | null>(null);
  const [vuaDoi, setVuaDoi] = useState<{ s: CoverSlot; cu: OBia } | null>(null);
  const [traLai, setTraLai] = useState<string | null>(null);
  const [ban, setBan] = useState(false);
  const [dangLuu, chay] = useTransition();

  async function ghi(roundId: string | null, v: OBia): Promise<{ error: string } | undefined> {
    try {
      if (v === null) return await actionRemoveCoverEntry(bookId, roundId);
      const fd = new FormData();
      fd.set("cover", v.cover);
      if (v.coverMediaId !== null) fd.set("coverMedia", v.coverMediaId);
      return await actionSetCoverEntry(bookId, roundId, fd);
    } catch {
      return { error: MAT_MANG };
    }
  }

  function luu(i: number, v: CoverValue, thu: () => void) {
    if (ban) return;
    const s = slots[i];
    const moi: OBia = v.cover === null ? null : { cover: v.cover, coverMediaId: v.photoId };
    if (giong(os[i], moi)) {
      thu();
      return;
    }
    chay(async () => {
      const r = await ghi(s.roundId, moi);
      if (r) {
        setLoi({ i, chu: r.error });
        return;
      }
      setLoi(null);
      setTraLai(null);
      setVuaDoi({ s, cu: os[i] });
      thu();
    });
  }

  function hoanTac() {
    if (!vuaDoi) return;
    chay(async () => {
      const r = await ghi(vuaDoi.s.roundId, vuaDoi.cu);
      setVuaDoi(null);
      setTraLai(r ? r.error : "Đã trả lại như cũ.");
    });
  }

  const soLuot = slots.length - 1;
  const coBia = slots.flatMap((s) => (s.o === null ? [] : [s.o]));
  // Xap nho: toi da ba bia gan nhat, bia moi nhat dau tien trong DOM (nam tren cung).
  const xap: typeof coBia = [];
  for (let k = coBia.length - 1; k >= 0 && xap.length < 3; k--) xap.push(coBia[k]);
  const dangDung = dung >= 0 ? os[dung] : null;
  const tom = (
    <>
      <span className="xap-bia" aria-hidden="true">
        {xap.map((b) => (
          <span key={b.id} className={`xap-bia__la bia bia--${b.cover}`}>
            <CoverArt cover={b.cover} />
            <CoverImage mediaId={b.coverMediaId} />
          </span>
        ))}
      </span>
      <span className="tg__tom-chu">
        <b>{dangDung === null ? "Chưa có bìa" : tenBia(dangDung)}</b>
        <span>{soLuot === 0 ? "Chưa có lượt đăng nào" : `${coBia.length} bìa qua ${soLuot} lượt đăng`}</span>
      </span>
    </>
  );

  const moc: MocDong[] = slots.map((s, i) => {
    const own = os[i];
    return {
      key: s.roundId ?? "mo-dau",
      ngay: dateLabel(s.at, now),
      luot: s.ordinal === null ? "Tạo sách" : `Lượt ${s.ordinal}`,
      nut: <span className={own === null ? "tg-dong__nut" : "tg-dong__nut tg-dong__nut--co"} aria-hidden="true" />,
      noi: (
        <>
          <BiaNho bia={hien[i]} giu={own === null} />
          <span className="tg-dong__chu">
            {own === null ? (
              <>Giữ bìa trước{hien[i] !== null && <span className="sr-only">{` (${tenBia(hien[i])})`}</span>}</>
            ) : <b>{tenBia(own)}</b>}
            {i === dung && <span className="dh dh--moi"><span className="cham" aria-hidden="true" />Đang dùng</span>}
          </span>
        </>
      ),
    };
  });

  const bao = vuaDoi ? (
    <>
      <span>{`Đã lưu bìa ${tenLuot(vuaDoi.s)}.`}</span>
      <button type="button" className="btn btn--chu" disabled={dangLuu} onClick={hoanTac}>Hoàn tác</button>
    </>
  ) : traLai;

  return (
    <DongThoiGian
      ma="bia"
      nhan="Bìa"
      goi="Bấm một mốc để đổi bìa của lượt đó. Chọn xong là lưu."
      tom={tom}
      moc={moc}
      ban={ban}
      bao={bao}
      renderRot={(i, thu) => (
        <ChonBia
          s={slots[i]}
          dau={i === 0}
          photos={photos}
          bookId={bookId}
          mediaEnabled={mediaEnabled}
          loi={loi?.i === i ? loi.chu : null}
          dangLuu={dangLuu}
          onChon={(v) => luu(i, v, thu)}
          onBan={setBan}
        />
      )}
    />
  );
}
