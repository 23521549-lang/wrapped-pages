"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { actionSetMood, actionWithdrawMood } from "@/app/actions/mood";
import { CHUA_THA_DUOC } from "@/app/actions/messages";
import { NHAN_DAI, NOTE_MAX, parseMoodInput } from "@/lib/tam-trang/input";
import { TROI, WEATHERS, type Weather } from "@/lib/tam-trang/troi";
import { Hoa } from "./HoaEp";

/** Id cua hop chon: nut mo tro toi no bang aria-controls. */
const HOP = "tha-tam-trang";

/** Tam trang nguoi xem dang giu, da tinh san nhan "con N gio" o may chu (mot dong ho voi ke sach). */
export type DangGiu = { weather: Weather; conLai: string };

/**
 * Dong tieu de ke sach va hop Tha tam trang mo ngay ben duoi, dung ban mau. Nut "Tha tam trang" mang cham mau troi cua
 * tam trang dang giu (vien dut khi chua giu gi), dung truoc nut phu (Sach moi). Hop luon co trong DOM (an bang hidden)
 * de aria-controls luon tro dung cho. Tha va thu lai goi server action; may chu refresh() nen cham mau va dong "Ban
 * dang giu" ve lai tu du lieu that.
 *
 * Chon mot o troi chi doi MOT bien trang thai: cay JSX cua chin o khong doi hinh dang, khong doi khoa va khong bi bao
 * boc them gi, nen React chi sua thuoc tinh checked tren dung mot the input. Khong the nao bi ve lai ca man, khong lan
 * dung lai DOM, nen hoat anh cua cac o khong khoi dong lai, khong xo dich, khong nhay cuon, va focus o yen tren o vua
 * bam. Bo dem loi nhan dem theo CODE POINT va o nhap khong dat maxLength: maxLength cua trinh duyet dem theo don vi
 * UTF-16 nen se cat 80 bieu tuong cam xuc con mot nua. Doi lai, gioi han phai thay duoc NGAY trong luc go: bo dem doi
 * sang kieu bao loi, o nhap thanh aria-invalid, mot dong ly do hien ra ngay duoi o (ca o nhap va nut "Tha" deu tro
 * toi no bang aria-describedby) va nut "Tha" bi tat chung nao con vuot. parseMoodInput trong tha() la lop chan cuoi
 * cung (dung luat voi may chu: chua chon troi, loi nhan qua dai, ca nguong 320 ky tu truoc khi chuan hoa).
 */
export function ThaTamTrang({ dau, nutPhu, dangGiu, tenKia }: {
  dau: ReactNode;
  nutPhu: ReactNode;
  dangGiu: DangGiu | null;
  tenKia: string;
}) {
  const [mo, setMo] = useState(false);
  const [chon, setChon] = useState<Weather | null>(null);
  const [nhan, setNhan] = useState("");
  const [loi, setLoi] = useState("");
  const [bao, setBao] = useState("");
  const [dangGui, batDau] = useTransition();
  const nutRef = useRef<HTMLButtonElement>(null);
  const hopRef = useRef<HTMLElement>(null);
  const soChu = [...nhan].length;
  const qua = soChu > NOTE_MAX;
  // Bo dem: dam khi vua day, them kieu bao loi khi da vuot. Mot chuoi lop thay vi ba nhanh dieu kieu long nhau.
  const lopDem = `nhan__dem${soChu >= NOTE_MAX ? " nhan__dem--day" : ""}${qua ? " nhan__dem--qua" : ""}`;

  // Esc dong hop tu bat ky dieu khien nao ben trong, focus ve nut mo. Nghe tren chinh hop chi khi hop dang mo.
  useEffect(() => {
    const hop = hopRef.current;
    if (!mo || hop === null) return undefined;
    function nghe(e: globalThis.KeyboardEvent) {
      if (e.key !== "Escape") return;
      setMo(false);
      setChon(null);
      setNhan("");
      setLoi("");
      nutRef.current?.focus();
    }
    hop.addEventListener("keydown", nghe);
    return () => hop.removeEventListener("keydown", nghe);
  }, [mo]);

  function dong() {
    setMo(false);
    setChon(null);
    setNhan("");
    setLoi("");
  }

  function thoi() {
    dong();
    nutRef.current?.focus();
  }

  function batTat() {
    if (mo) {
      thoi();
      return;
    }
    setLoi("");
    setMo(true);
  }

  function tha() {
    // Cung mot ham kiem voi server action: chua chon troi hay loi nhan qua dai deu ra dung cau bao do, khong cho mot
    // vong goi may chu moi biet.
    const vao = parseMoodInput(chon, nhan);
    if ("error" in vao) {
      setLoi(vao.error);
      return;
    }
    batDau(async () => {
      try {
        const r = await actionSetMood(vao.weather, vao.note);
        if ("error" in r) {
          setLoi(r.error);
          return;
        }
        dong();
        setBao(`Đã thả ${TROI[vao.weather].ten}. Giữ trong 24 giờ.`);
        nutRef.current?.focus();
      } catch {
        setLoi(CHUA_THA_DUOC);
      }
    });
  }

  function thuLai() {
    batDau(async () => {
      try {
        const r = await actionWithdrawMood();
        if ("error" in r) {
          setLoi(r.error);
          return;
        }
        setBao("Đã thu lại tâm trạng.");
        nutRef.current?.focus();
      } catch {
        setLoi(CHUA_THA_DUOC);
      }
    });
  }

  return (
    <>
      <div className="ke-dau">
        {dau}
        <div className="ke-dau__nut">
          <button ref={nutRef} type="button" className="btn btn--quiet" aria-expanded={mo} aria-controls={HOP} onClick={batTat}>
            <span className={dangGiu ? `o-mau troi--${dangGiu.weather}` : "o-mau o-mau--trong"} aria-hidden="true" />
            Thả tâm trạng
          </button>
          {nutPhu}
        </div>
      </div>

      <section className="tha" id={HOP} aria-labelledby={`${HOP}-t`} hidden={!mo} ref={hopRef}>
        <div className="tha__dau">
          <div>
            <h2 className="d" id={`${HOP}-t`}>Thả tâm trạng</h2>
            <p className="tha__hoi">Lòng bạn lúc này thế nào?</p>
          </div>
        </div>
        {dangGiu && (
          <p className="tha__giu">
            <span className={`o-mau troi--${dangGiu.weather}`} aria-hidden="true" />
            <span>Bạn đang giữ <b>{TROI[dangGiu.weather].ten}</b>, {dangGiu.conLai}.</span>
            <button type="button" className="btn btn--chu" onClick={thuLai} disabled={dangGui}>Thu lại</button>
          </p>
        )}
        <div className="tha__than">
          <fieldset>
            <legend className="sr-only">Kiểu trời</legend>
            <div className="o-troi">
              {WEATHERS.map((w) => (
                <label key={w} className={`o troi--${w}`}>
                  <input
                    type="radio"
                    name="troi"
                    value={w}
                    checked={chon === w}
                    onChange={() => {
                      setChon(w);
                      setLoi("");
                    }}
                  />
                  <span className="o__troi" aria-hidden="true">
                    <Hoa weather={w} />
                    <span className="o__dau">
                      <svg viewBox="0 0 10 10" focusable="false">
                        <path d="M2 5.2 L4.2 7.2 L8 2.8" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </span>
                  <span className="o__ten">{TROI[w].ten}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="nhan">
            <div className="nhan__dau">
              <label htmlFor={`${HOP}-nhan`}>Lời nhắn</label>
              <span className={lopDem} id={`${HOP}-dem`}>{`${soChu}/${NOTE_MAX}`}</span>
            </div>
            <input
              className="input"
              id={`${HOP}-nhan`}
              value={nhan}
              onChange={(e) => setNhan(e.target.value)}
              aria-invalid={qua || undefined}
              autoComplete="off"
              placeholder="Nhớ cậu một chút thôi."
              aria-describedby={qua ? `${HOP}-dem ${HOP}-qua ${HOP}-goi` : `${HOP}-dem ${HOP}-goi`}
            />
            {qua && <p className="nhan__qua" id={`${HOP}-qua`}>{NHAN_DAI}</p>}
            <p className="nhan__goi" id={`${HOP}-goi`}>{`Không bắt buộc. ${tenKia} sẽ thấy dưới bầu trời.`}</p>
            <div className="tha__cuoi">
              <button
                type="button"
                className="btn"
                onClick={tha}
                disabled={dangGui || qua}
                aria-describedby={qua ? `${HOP}-qua` : undefined}
                aria-busy={dangGui || undefined}
              >
                Thả
              </button>
              <button type="button" className="btn btn--quiet" onClick={thoi}>Thôi</button>
              <span className="tha__han">
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                  <circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth={1.2} />
                  <path d="M8 4.6 V8 L10.4 9.4" fill="none" stroke="currentColor" strokeWidth={1.2} strokeLinecap="round" />
                </svg>
                Giữ trong 24 giờ
              </span>
              {loi !== "" && <p className="tha__loi" role="alert">{loi}</p>}
            </div>
          </div>
        </div>
        <p className="tha__lich"><Link className="btn btn--chu" href="/tam-trang">Xem lịch hoa</Link></p>
      </section>
      <p className="sr-only" aria-live="polite">{bao}</p>
    </>
  );
}
