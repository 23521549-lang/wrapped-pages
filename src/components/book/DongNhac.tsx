"use client";

import { useState, useTransition } from "react";
import { actionRemoveTrackEntry, actionSetTrackEntry } from "@/app/actions/library";
import { NotNhac } from "@/components/glyph";
import { baiTheoLuot, cuoiCo } from "@/lib/dong-luot";
import { parseYoutubeLink, youtubeLink } from "@/lib/youtube";
import { dateLabel } from "@/lib/when";
import type { TrackSlot } from "@/server/library/timeline";
import { DongThoiGian, type MocDong } from "./DongThoiGian";

/** O nhac rieng cua mot luot: ma video, hay null la o go nhac. null ca o la luot phat tiep bai truoc. */
type ONhac = { youtubeId: string | null } | null;
/** Ba lua chon cua bang rũ xuống: dat mot bai, phat tiep bai truoc (bo o), tat nhac tu luot nay (o go nhac). */
type Chon = "bai" | "tiep" | "tat";

const MAT_MANG = "Chưa lưu được. Kiểm tra mạng rồi thử lại.";
const THAY_TEN = "Bản nhạc trên YouTube";

export type TenBai = Record<string, { ten: string; kenh: string | null }>;

export type DongNhacProps = {
  bookId: string;
  /** Ca dong thoi gian nhac, gom ca o trong cua luot chua dat nhac. */
  slots: readonly TrackSlot[];
  /** Ten bai va kenh lay tu YouTube o may chu (tenCacBai); bai lay khong duoc thi khong co khoa. */
  ten: TenBai;
  now: Date;
};

const tenLuot = (s: TrackSlot) => (s.ordinal === null ? "lúc tạo sách" : `lượt ${s.ordinal}`);
const chonCua = (o: ONhac, dau: boolean): Chon => (o === null || (dau && o.youtubeId === null) ? "tiep" : o.youtubeId === null ? "tat" : "bai");

/** Bang nhac rũ xuống duoi mot moc: ba nut vien thuoc va o dan link. Chon la luu; link doc ra video la luu. */
function ChonNhac({ s, dau, o, truoc, tenCua, loi, dangLuu, onLuu }: {
  s: TrackSlot; dau: boolean; o: ONhac; truoc: string | null; tenCua: (id: string) => string; loi: string | null; dangLuu: boolean;
  onLuu: (v: ONhac) => void;
}) {
  const [chon, setChon] = useState<Chon>(chonCua(o, dau));
  const [lien, setLien] = useState(o?.youtubeId ? youtubeLink(o.youtubeId) : "");
  const kiem = parseYoutubeLink(lien);
  const ten = `nhac-${s.roundId ?? "mo-dau"}`;
  const nut = (gt: Chon, chu: string) => (
    <label className="nut-dinh-dang tg-chon">
      <input
        type="radio"
        name={ten}
        value={gt}
        checked={chon === gt}
        disabled={dangLuu}
        onChange={() => {
          setChon(gt);
          if (gt === "tiep") onLuu(null);
          else if (gt === "tat") onLuu({ youtubeId: null });
        }}
      />
      {chu}
    </label>
  );
  const goi = !kiem.ok && lien.trim() !== ""
    ? <span className="field__help--loi">{kiem.error}</span>
    : kiem.ok && kiem.id !== null
      ? <><span className="chip chip--key">Đã nhận video</span> {tenCua(kiem.id)}</>
      : "Dán link YouTube, đọc ra bài là lưu.";
  return (
    <fieldset className="tg-nhac">
      <legend className="sr-only">{`Nhạc ${tenLuot(s)}`}</legend>
      <div className="tg-nhac__nut">
        {nut("bai", "Một bài")}
        {dau ? nut("tiep", "Không nhạc") : (
          <>
            {nut("tiep", truoc === null ? "Phát tiếp" : `Phát tiếp ${tenCua(truoc)}`)}
            {nut("tat", "Tắt nhạc")}
          </>
        )}
      </div>
      {chon === "bai" && (
        <div className="field tg-nhac__lien">
          <div className="field__o">
            <input
              className="input"
              type="url"
              inputMode="url"
              value={lien}
              placeholder="https://youtu.be/..."
              aria-label="Link YouTube"
              aria-invalid={!kiem.ok && lien.trim() !== ""}
              autoComplete="off"
              spellCheck={false}
              disabled={dangLuu}
              // O nay nam trong form Sua sach: Enter khong duoc gui ca form (luu ten va roi trang).
              onKeyDown={(e) => {
                if (e.key === "Enter") e.preventDefault();
              }}
              onChange={(e) => {
                const moi = e.target.value;
                setLien(moi);
                const k = parseYoutubeLink(moi);
                if (k.ok && k.id !== null && k.id !== o?.youtubeId) onLuu({ youtubeId: k.id });
              }}
            />
          </div>
          <p className="field__help field__help--co">{goi}</p>
        </div>
      )}
      {loi !== null && <p className="form__loi" role="alert">{loi}</p>}
    </fieldset>
  );
}

/**
 * Truong Nhac nen cua man Sua sach (chu du an duyet 28/09): dong thoi gian nhac theo tung luot, thu gon mac dinh. Moi luot
 * dat duoc mot bai, tat nhac, hay phat tiep bai truoc; soi doc lien o doan co nhac, cham o doan im. Chon la ghi ngay mot
 * o (actionSetTrackEntry, hay bo o khi Phat tiep), roi bang chon cuon len. Hoan tac ghi lai gia tri cu.
 */
export function DongNhac({ bookId, slots, ten, now }: DongNhacProps) {
  const os: ONhac[] = slots.map((s) => (s.o === null ? null : { youtubeId: s.o.youtubeId }));
  const bai = baiTheoLuot(os);
  const dangPhat = bai.at(-1) ?? null;
  const cuoiBai = cuoiCo(os.map((o) => (o?.youtubeId ? o : null)));
  const [loi, setLoi] = useState<{ i: number; chu: string } | null>(null);
  const [vuaDoi, setVuaDoi] = useState<{ s: TrackSlot; cu: ONhac } | null>(null);
  const [traLai, setTraLai] = useState<string | null>(null);
  const [dangLuu, chay] = useTransition();
  const tenCua = (id: string) => ten[id]?.ten ?? THAY_TEN;

  async function ghi(roundId: string | null, v: ONhac): Promise<{ error: string } | undefined> {
    try {
      if (v === null) return await actionRemoveTrackEntry(bookId, roundId);
      const fd = new FormData();
      if (v.youtubeId === null) fd.set("dropTrack", "1");
      else fd.set("music", youtubeLink(v.youtubeId));
      return await actionSetTrackEntry(bookId, roundId, fd);
    } catch {
      return { error: MAT_MANG };
    }
  }

  function luu(i: number, v: ONhac, thu: () => void) {
    const s = slots[i];
    const cu = os[i];
    if ((cu === null && v === null) || (cu !== null && v !== null && cu.youtubeId === v.youtubeId)) {
      thu();
      return;
    }
    chay(async () => {
      const r = await ghi(s.roundId, v);
      if (r) {
        setLoi({ i, chu: r.error });
        return;
      }
      setLoi(null);
      setTraLai(null);
      setVuaDoi({ s, cu });
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
  const soDat = os.filter((o) => o !== null).length;
  const kenh = dangPhat === null ? null : (ten[dangPhat]?.kenh ?? null);
  const tom = (
    <>
      <span className={dangPhat === null ? "tg__not tg__not--tat" : "tg__not"} aria-hidden="true"><NotNhac go={dangPhat === null} /></span>
      <span className="tg__tom-chu">
        <b>{dangPhat === null ? "Không có nhạc" : tenCua(dangPhat)}</b>
        <span>{`${kenh === null ? "" : `${kenh}, `}${soLuot === 0 ? "chưa có lượt đăng nào" : `${soDat} lần đặt nhạc qua ${soLuot} lượt đăng`}`}</span>
      </span>
    </>
  );

  const moc: MocDong[] = slots.map((s, i) => {
    const o = os[i];
    let nut;
    let noi;
    if (o !== null && o.youtubeId !== null) {
      const kenhBai = ten[o.youtubeId]?.kenh ?? null;
      nut = <span className="tg-dong__not" aria-hidden="true"><NotNhac /></span>;
      noi = <><b>{tenCua(o.youtubeId)}</b>{kenhBai !== null && <span>{kenhBai}</span>}</>;
    } else if (o !== null || i === 0) {
      nut = <span className="tg-dong__not tg-dong__not--tat" aria-hidden="true"><NotNhac go /></span>;
      noi = o !== null && i > 0 ? "Tắt nhạc từ lượt này" : "Không có nhạc";
    } else {
      nut = <span className="tg-dong__nut" aria-hidden="true" />;
      noi = bai[i - 1] === null ? "Vẫn không có nhạc" : <>Phát tiếp<span className="sr-only">{` ${tenCua(bai[i - 1] ?? "")}`}</span></>;
    }
    return {
      key: s.roundId ?? "mo-dau",
      ngay: dateLabel(s.at, now),
      luot: s.ordinal === null ? "Tạo sách" : `Lượt ${s.ordinal}`,
      nut,
      noi: (
        <span className="tg-dong__chu">
          {noi}
          {i === cuoiBai && dangPhat !== null && <span className="dh dh--moi"><span className="cham" aria-hidden="true" />Đang phát</span>}
        </span>
      ),
      im: bai[i] === null,
    };
  });

  const bao = vuaDoi ? (
    <>
      <span>{`Đã lưu nhạc ${tenLuot(vuaDoi.s)}.`}</span>
      <button type="button" className="btn btn--chu" disabled={dangLuu} onClick={hoanTac}>Hoàn tác</button>
    </>
  ) : traLai;

  return (
    <DongThoiGian
      ma="nhac"
      nhan="Nhạc nền"
      goi="Bấm một mốc để đổi nhạc của lượt đó. Chọn xong là lưu."
      tom={tom}
      moc={moc}
      bao={bao}
      renderRot={(i, thu) => (
        <ChonNhac
          s={slots[i]}
          dau={i === 0}
          o={os[i]}
          truoc={i === 0 ? null : bai[i - 1]}
          tenCua={tenCua}
          loi={loi?.i === i ? loi.chu : null}
          dangLuu={dangLuu}
          onLuu={(v) => luu(i, v, thu)}
        />
      )}
    />
  );
}
