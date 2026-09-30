"use client";

import { Fragment, useEffect, useEffectEvent, useId, useRef, useState } from "react";
import { actionDocChip, actionHoiChip } from "@/app/actions/chip";
import { CHUA_GUI_CHIP } from "@/app/actions/messages";
import type { LoaiCamXuc } from "@/lib/cam-xuc";
import { CAU_CHUA_DANH_THUC, lucDay, NHAP_TOI_DA, tachDam } from "@/lib/chip";
import { dayKey, dayLabel } from "@/lib/when";
import type { TinChip } from "@/server/chip/tro-chuyen";
import { AnhLinhVat } from "./AnhLinhVat";
import { KhoCamXuc } from "./KhoCamXuc";
import { docViec, tenTrang } from "./viec";

/** Tin Chip: **dam** thanh chu dam, xuong dong giu nguyen (CSS pre-line). Khong bao gio dung HTML. */
function ChuTin({ noiDung }: { noiDung: string }) {
  return (
    <>
      {tachDam(noiDung).map((d) => (d.dam ? <b key={d.o}>{d.chu}</b> : <Fragment key={d.o}>{d.chu}</Fragment>))}
    </>
  );
}

export type TroChuyenProps = {
  tenMinh: string;
  tenKia: string;
  nguDen: Date | null;
  coKhoa: boolean;
  /** Chip vua di ngu (hay thuc) theo tra loi cua may chu. */
  doiNgu: (den: Date | null) => void;
  dong: () => void;
  thuNho: () => void;
  daTha: (loai: LoaiCamXuc) => void;
};

/**
 * To tro chuyen voi Chip (5e, spec D): dau to (Chip, trang thai, Thu nho, Dong), cac tin theo ngay, cuoi to la nut mo Kho
 * cam xuc va o "Nói với Chíp" (Enter gui, Shift+Enter xuong dong). Mo ra thi doc cuoc tro chuyen cua chinh nguoi dung;
 * dang cho tra loi thi ba cham "Chíp đang gõ". Chip ngu hay chua duoc danh thuc thi o nhap tat, kho van dung duoc. Esc dong.
 */
export function TroChuyen({ tenMinh, tenKia, nguDen, coKhoa, doiNgu, dong, thuNho, daTha }: TroChuyenProps) {
  const id = useId();
  const [tin, setTin] = useState<TinChip[] | null>(null);
  const [nhap, setNhap] = useState("");
  const [dangHoi, setDangHoi] = useState(false);
  const [loi, setLoi] = useState("");
  const [moKho, setMoKho] = useState(false);
  const toRef = useRef<HTMLElement>(null);
  const cuonRef = useRef<HTMLElement>(null);
  const oRef = useRef<HTMLTextAreaElement>(null);
  const khoaNhap = nguDen !== null || !coKhoa;
  const baoNgu = useEffectEvent((den: Date | null) => doiNgu(den));
  const dongTo = useEffectEvent(() => dong());
  const oDauTien = useEffectEvent(() => (khoaNhap ? toRef.current?.querySelector<HTMLButtonElement>(".tc__kho") : oRef.current));

  // Mo to thi doc cuoc tro chuyen mot lan.
  useEffect(() => {
    let con = true;
    void actionDocChip().then((r) => {
      if (!con || r === null) return;
      setTin(r.tin);
      baoNgu(r.trangThai.nguDen);
    }, () => {
      if (con) setTin([]);
    });
    return () => {
      con = false;
    };
  }, []);

  // Mo to thi focus o nhap (hay nut kho khi o nhap dang tat); Esc o bat ky dau trong to thi dong.
  useEffect(() => {
    const to = toRef.current;
    if (!to) return;
    oDauTien()?.focus();
    const phim = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      dongTo();
    };
    to.addEventListener("keydown", phim);
    return () => to.removeEventListener("keydown", phim);
  }, []);

  // Tin moi thi cuon xuong cuoi.
  useEffect(() => {
    const cuon = cuonRef.current;
    if (cuon) cuon.scrollTop = cuon.scrollHeight;
  }, [tin, dangHoi]);

  async function gui() {
    const chu = nhap.trim();
    if (chu === "" || dangHoi || khoaNhap) return;
    setDangHoi(true);
    setLoi("");
    const tam: TinChip = { id: `cho-${Date.now()}`, vai: "nguoi", noiDung: chu, luc: new Date() };
    setTin((cu) => [...(cu ?? []), tam]);
    setNhap("");
    try {
      const r = await actionHoiChip(chu, tenTrang(), docViec());
      if ("error" in r) {
        setTin((cu) => (cu ?? []).filter((t) => t.id !== tam.id));
        setNhap(chu);
        setLoi(r.error);
        return;
      }
      setTin((cu) => [...(cu ?? []).filter((t) => t.id !== tam.id), ...r.tin]);
      if (r.nguDen !== null) doiNgu(r.nguDen);
    } catch {
      setTin((cu) => (cu ?? []).filter((t) => t.id !== tam.id));
      setNhap(chu);
      setLoi(CHUA_GUI_CHIP);
    } finally {
      setDangHoi(false);
    }
  }

  const now = new Date();
  const trangThai = !coKhoa ? "Chưa được đánh thức" : nguDen !== null ? `Đang ngủ, ${lucDay(nguDen, now)} dậy` : "Đang thức";
  let ngayTruoc = "";
  return (
    <section className="tc" ref={toRef} aria-labelledby={`${id}-t`}>
      <div className="tc__dau">
        <AnhLinhVat loai={null} className="tc__chip" tinh={nguDen !== null} />
        <p className="tc__ten"><b id={`${id}-t`}>Chíp</b><span>{trangThai}</span></p>
        <button type="button" className="tc__nut" aria-label="Thu nhỏ Chíp" onClick={thuNho}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8h10" /></svg>
        </button>
        <button type="button" className="tc__nut" aria-label="Đóng trò chuyện" onClick={dong}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3l10 10M13 3L3 13" /></svg>
        </button>
      </div>
      {/* Vung cuon nhan focus (nhu cot Hoat dong) de nguoi dung ban phim cuon duoc tin cu bang phim mui ten. */}
      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- vung cuon, khong co cach cuon bang phim nao khac */}
      <section className="tc__cuon" ref={cuonRef} tabIndex={0} aria-label="Tin trò chuyện với Chíp">
      <ol className="tc__ds" aria-live="polite" aria-relevant="additions" aria-busy={tin === null}>
        {tin !== null && tin.length === 0 && (
          <li className="tin tin--chip">{`Chào ${tenMinh}! Chíp đây. Hỏi Chíp chuyện trên web, hay kể Chíp nghe chuyện hôm nay nhé.`}</li>
        )}
        {tin?.map((t) => {
          const ngay = dayKey(t.luc);
          const moiNgay = ngay !== ngayTruoc;
          ngayTruoc = ngay;
          return (
            <Fragment key={t.id}>
              {moiNgay && <li className="tc__ngay" aria-hidden="true">{dayLabel(t.luc, now)}</li>}
              <li className={t.vai === "chip" ? "tin tin--chip" : "tin tin--minh"}>
                <span className="sr-only">{t.vai === "chip" ? "Chíp: " : "Bạn: "}</span>
                <ChuTin noiDung={t.noiDung} />
              </li>
            </Fragment>
          );
        })}
        {dangHoi && (
          <li className="tin tin--chip tin--go">
            <span className="sr-only">Chíp đang gõ</span>
            <span className="go" aria-hidden="true"><span /><span /><span /></span>
          </li>
        )}
      </ol>
      </section>
      <div className="tc__chan">
        <button type="button" className="btn btn--line btn--sm tc__kho" aria-expanded={moKho} aria-controls={`${id}-kho`} onClick={() => setMoKho((x) => !x)}>
          Thả cảm xúc cho {tenKia}
        </button>
        {moKho && (
          <div id={`${id}-kho`}>
            <KhoCamXuc tenMinh={tenMinh} tenKia={tenKia} daTha={daTha} />
          </div>
        )}
        {khoaNhap && (
          <p className="tc__ghi">{coKhoa ? "Chíp đang ngủ nên chưa trả lời được. Thả cảm xúc vẫn được." : CAU_CHUA_DANH_THUC}</p>
        )}
        {loi !== "" && <p className="form__loi" role="alert">{loi}</p>}
        <form
          className="tc__nhap"
          onSubmit={(e) => {
            e.preventDefault();
            void gui();
          }}
        >
          <label className="sr-only" htmlFor={`${id}-o`}>Nói với Chíp</label>
          <textarea
            id={`${id}-o`}
            ref={oRef}
            rows={1}
            value={nhap}
            maxLength={NHAP_TOI_DA}
            placeholder="Nói với Chíp..."
            disabled={khoaNhap}
            onChange={(e) => setNhap(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter" || e.shiftKey || e.nativeEvent.isComposing) return;
              e.preventDefault();
              void gui();
            }}
          />
          <button type="submit" className="btn" disabled={khoaNhap || dangHoi || nhap.trim() === ""} aria-busy={dangHoi || undefined}>Gửi</button>
        </form>
      </div>
    </section>
  );
}
