"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { actionSetMood, actionWithdrawMood } from "@/app/actions/mood";
import { CHUA_THA_DUOC } from "@/app/actions/messages";
import { NHAN_DAI, NOTE_MAX, parseMoodInput } from "@/lib/tam-trang/input";
import { thaLabel, type TroiHien } from "@/lib/tam-trang/lich";
import { LOANG_HET_MS } from "@/lib/tam-trang/loang-nhip";
import { TROI, WEATHERS, type Weather } from "@/lib/tam-trang/troi";
import { timeLabel } from "@/lib/when";
import { cuonLenDinh } from "./cuon-len";
import { Hoa } from "./HoaEp";
import { coLoang, useTroiTam } from "./troi-tam";

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
export function ThaTamTrang({ dau, nutPhu, dangGiu, minh, tenKia }: {
  dau: ReactNode;
  nutPhu: ReactNode;
  dangGiu: DangGiu | null;
  /** Bau troi cua nguoi xem ma may chu dang ve (cung gia tri dai troi nhan): de biet lan tha nay co loang khong. */
  minh: TroiHien | null;
  tenKia: string;
}) {
  const [mo, setMo] = useState(false);
  const [chon, setChon] = useState<Weather | null>(null);
  const [nhan, setNhan] = useState("");
  const [loi, setLoi] = useState("");
  const [bao, setBao] = useState("");
  const [dangGui, batDau] = useTransition();
  /** Mot lan tha dang chay (trang cuon len, troi doi, loang): hop van mo nhung khoa lai, khong bam them duoc. */
  const [dangTha, setDangTha] = useState(false);
  /**
   * Dong "Ban dang giu" luc bam Tha. Suot lan tha hop hien dung dong nay: may chu tra loi trong luc hop con mo thi dong
   * that doi (Nang am thanh Giong, hay tu khong co thanh co), ma doi ngay truoc mat la mot lan xo dich chu trong hop.
   */
  const [giuLucTha, setGiuLucTha] = useState<DangGiu | null>(null);
  const giuHien = dangTha ? giuLucTha : dangGiu;
  const nutRef = useRef<HTMLButtonElement>(null);
  const nutThaRef = useRef<HTMLButtonElement>(null);
  const hopRef = useRef<HTMLElement>(null);
  /** Hop vua duoc mo lai sau khi may chu tu choi: dua focus toi nut Tha de nguoi dung thu lai ngay. */
  const moLaiRef = useRef(false);
  const { tam, datTam, datGiu } = useTroiTam();
  /** Huy lan cuon len dai troi dang cho (lan tha moi thay lan cu, hay thanh phan go ra giua chung). */
  const huyCuon = useRef<(() => void) | null>(null);
  /** So thu tu lan tha gan nhat; hop dang thuoc lan tha nao (0 la khong lan nao); hen thu hop sau khi troi doi xong. */
  const lanTha = useRef(0);
  const hopCuaLan = useRef(0);
  const henThu = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  /** Lan tha da duoc may chu luu; lan tha da tu thu hop lai (va chua ai mo lai hop). */
  const daLuu = useRef(0);
  const daThuHop = useRef(0);
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
      nhaHop();
      dong();
      nutRef.current?.focus();
    }
    hop.addEventListener("keydown", nghe);
    return () => hop.removeEventListener("keydown", nghe);
  }, [mo]);

  function xoaChon() {
    setChon(null);
    setNhan("");
    setLoi("");
  }

  function dong() {
    setMo(false);
    xoaChon();
  }

  /** Hop thoi thuoc ve lan tha dang chay: bo hen thu hop, mo khoa. Lan tha van chay tiep (troi van doi), chi khong dong hop. */
  function nhaHop() {
    clearTimeout(henThu.current);
    hopCuaLan.current = 0;
    setDangTha(false);
  }

  function thoi() {
    nhaHop();
    dong();
    nutRef.current?.focus();
  }

  function batTat() {
    if (mo) {
      thoi();
      return;
    }
    daThuHop.current = 0;
    setLoi("");
    setMo(true);
  }

  /*
   * Hop NOI tren ke sach (tam-trang.css), khong nam trong dong chay: mo hay thu lai luc nao cung khong xo dich ke. Nho vay
   * hop tha duoc giu mo suot lan tha va chi thu lai sau khi troi doi xong (chu du an 27/09), vai giay sau cu bam, ma CLS
   * van bang 0 (truoc day hop day ke xuong, dong muon hon nua giay sau cu bam la mot lan xo dich 0,216 toi 0,707).
   * Lua chon cua nguoi dung chi bi xoa khi may chu da nhan; may chu tu choi thi hop mo (hay mo lai) kem cau bao, giu
   * nguyen lua chon, va focus toi nut Tha de thu lai duoc ngay.
   */
  function moLaiVoiLoi(cau: string) {
    setLoi(cau);
    moLaiRef.current = true;
    setMo(true);
  }

  useEffect(() => () => {
    huyCuon.current?.();
    clearTimeout(henThu.current);
  }, []);

  // Focus toi nut Tha sau khi hop da mo lai tren man VA lan gui da xong han: luc goi setMo(true) hop van dang an, va
  // trong luc transition con chay nut Tha van bi tat, ma trinh duyet khong cho focus vao mot nut dang tat.
  useEffect(() => {
    if (!mo || dangGui || !moLaiRef.current) return;
    moLaiRef.current = false;
    nutThaRef.current?.focus();
  }, [mo, dangGui]);

  function tha() {
    // Cung mot ham kiem voi server action: chua chon troi hay loi nhan qua dai deu ra dung cau bao do, khong cho mot
    // vong goi may chu moi biet.
    const vao = parseMoodInput(chon, nhan);
    if ("error" in vao) {
      setLoi(vao.error);
      return;
    }
    setLoi("");
    /*
     * Chu du an 27/09: hop VAN MO (khoa lai, khong bam them), trang cuon len dai troi voi toc do mot cu cuon chuot, toi
     * noi thi dai troi doi NGAY sang troi TAM cua lan tha nay (khong cho may chu), va chi khi troi doi xong (het lan loang,
     * hay ngay khi khong co lan loang) hop moi thu lai. Trong luc cuon dai troi GIU NGUYEN bau troi dang hien, du may chu
     * da luu xong som hon. May chu tu choi thi dung han: thoi giu, go troi tam (chi khi no van la cua lan tha nay), mo
     * khoa va hop mo (lai) kem cau bao.
     */
    const lan = lanTha.current + 1;
    lanTha.current = lan;
    hopCuaLan.current = lan;
    daThuHop.current = 0;
    setGiuLucTha(dangGiu);
    setDangTha(true);
    // Focus ve nut mo nhung khong keo trang: hop sap bi khoa, va trang sap cuon len dai troi.
    nutRef.current?.focus({ preventScroll: true });
    const luc = new Date();
    const moi: TroiHien = { weather: vao.weather, note: vao.note, tha: thaLabel(luc, luc), gio: timeLabel(luc) };
    const truoc = tam ?? minh;
    const boTam = (cau: string) => {
      huyCuon.current?.();
      datGiu(false);
      datTam((t) => (t === moi ? null : t));
      nhaHop();
      moLaiVoiLoi(cau);
    };
    huyCuon.current?.();
    clearTimeout(henThu.current);
    datGiu(true);
    huyCuon.current = cuonLenDinh(() => {
      datGiu(false);
      datTam(moi);
      if (hopCuaLan.current !== lan) return;
      henThu.current = setTimeout(() => {
        if (hopCuaLan.current !== lan) return;
        nhaHop();
        daThuHop.current = lan;
        setMo(false);
        if (daLuu.current === lan) xoaChon();
      }, coLoang(truoc, moi) ? LOANG_HET_MS : 0);
    });
    batDau(async () => {
      try {
        const r = await actionSetMood(vao.weather, vao.note);
        if ("error" in r) {
          boTam(r.error);
          return;
        }
        daLuu.current = lan;
        // Hop da tu thu lai (va chua ai mo lai) thi xoa lua chon ngay; con dang mo cho loang thi xoa luc thu hop.
        if (daThuHop.current === lan) xoaChon();
        setBao(`Đã thả ${TROI[vao.weather].ten}. Giữ trong 24 giờ.`);
      } catch {
        boTam(CHUA_THA_DUOC);
      }
    });
  }

  function thuLai() {
    nhaHop();
    setLoi("");
    setMo(false);
    nutRef.current?.focus();
    // Thu lai trong luc mot lan tha con cho doi troi (nhip nghi 3 giay du dai de lam vay): bo luon lan doi troi do va
    // thoi giu, neu khong troi vua tha se hien len sau khi da thu lai va nam do toi luc tai lai trang.
    huyCuon.current?.();
    huyCuon.current = null;
    datGiu(false);
    datTam(null);
    batDau(async () => {
      try {
        const r = await actionWithdrawMood();
        if ("error" in r) {
          moLaiVoiLoi(r.error);
          return;
        }
        setBao("Đã thu lại tâm trạng.");
      } catch {
        moLaiVoiLoi(CHUA_THA_DUOC);
      }
    });
  }

  return (
    <>
      {/* Khung dinh vi cua hop tha: hop noi ngay duoi dong tieu de, de len ke sach. */}
      <div className="ke-dau-khung">
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

      <section className="tha" id={HOP} aria-labelledby={`${HOP}-t`} hidden={!mo} inert={dangTha || undefined} ref={hopRef}>
        <div className="tha__dau">
          <div>
            <h2 className="d" id={`${HOP}-t`}>Thả tâm trạng</h2>
            <p className="tha__hoi">Lòng bạn lúc này thế nào?</p>
          </div>
        </div>
        {giuHien && (
          <p className="tha__giu">
            <span className={`o-mau troi--${giuHien.weather}`} aria-hidden="true" />
            <span>Bạn đang giữ <b>{TROI[giuHien.weather].ten}</b>, {giuHien.conLai}.</span>
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
                ref={nutThaRef}
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
      </div>
      <p className="sr-only" aria-live="polite">{bao}</p>
    </>
  );
}
