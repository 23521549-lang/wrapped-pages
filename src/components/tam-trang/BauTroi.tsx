"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useTamDung } from "@/components/hieu-ung/tam-dung";
import { NOTE_MAX } from "@/lib/tam-trang/input";
import type { TroiHien } from "@/lib/tam-trang/lich";
import { TROI, WEATHERS } from "@/lib/tam-trang/troi";
import { dongChu, giamChuyenDong, goViec } from "./hieu-ung-chung";
import { Hoa } from "./HoaEp";
import { huyLoang, loangTroi, type MatLoang } from "./loang";
import { NetTroi } from "./NetTroi";
import { ganSong } from "./song";

/** Mot mat cua dai: bau troi lon cua ai, o cua so mang troi cua nguoi con lai (null khi chi mot nguoi co tam trang). */
type Mat = {
  /** "kia" hay "minh": khoa de doi cho, va de do bo cuc cua tung mat. */
  ten: string;
  troi: TroiHien;
  cuaSo: TroiHien | null;
  /** Ten hien cho trinh doc man hinh va cho chu nho duoi o cua so. */
  ai: string;
  aiCuaSo: string;
  laMinh: boolean;
  /** Cau bao khi mat nay thanh troi lon. */
  bao: string;
};

/**
 * Loi nhan dai het co cua khuon giu cho: NOTE_MAX bong hoa mau (U+1F338), khong phai mot cau tieng Viet.
 *
 * NOTE_MAX dem CODE POINT chu khong dem be rong (src/lib/tam-trang/input.ts), nen 80 chu tieng Viet khong chan duoc
 * chieu cao: 80 chu Han hay 80 bieu tuong cam xuc rong gan gap doi va an them hai dong. Bong hoa mau rong it nhat mot
 * o chu o moi he chu, tuc khong hep hon chu Han va rong hon moi chu La tinh, nen 80 bong hoa la can tren that cho moi
 * loi nhan go duoc (phan quyet M5). Cho con du duy nhat: vai ky tu co be rong bat thuong (vi du U+FDFD) van rong hon.
 */
const NHAN_KHUON = String.fromCodePoint(0x1f338).repeat(NOTE_MAX);

/**
 * Khuon giu cho chieu cao cua CA dai troi: chin ban tho xep chong trong MOT o luoi, moi ban kem mot loi nhan dai het
 * co, cong nhung hang co dinh cua mot bau troi (nhan "Ban", hang cuoi, o cua so khi ca hai cung giu tam trang).
 *
 * Vi sao mot khuon o muc dai troi chu khong phai moi bau troi mot khuon (phan quyet M4): khuon nam trong tung bau
 * troi se thanh 18 ban tho an luc nghi va 27 luc thay tam trang, va vi kho chu luon cao bang ban cao nhat, no day mot
 * khoang trong vao GIUA bai tho voi hang cuoi cua nhung troi ngan - dung cho chu du an da bac hai lan. O muc dai troi
 * thi moi bau troi van la mot o luoi, phan cao them roi xuong day bau troi (`.troi__chu{ flex: 1 0 auto }`), nen bo
 * cuc ben trong khong doi mot diem anh nao.
 *
 * Khuon mang dung nhung lop cua mot bau troi that (`troi`, `troi--cua-so`, `shell troi__chu`, `troi__noi`) de moi quy
 * tac `.troi ...` va `.troi--cua-so ...` deu ap len no y het: cung be rong cot chu, cung co chu, cung cho ngat dong.
 * Do bang khuon that chu khong bang mot con so px viet tay, nen no tu dung lai khi doi be rong, doi co chu hay khi
 * font ve muon.
 *
 * An bang visibility (tam-trang.css) chu khong bang display: none - display: none thi khuon khong do gi nua. Them
 * aria-hidden va inert cho chac, va hang cuoi cua khuon dung the span chu khong phai lien ket hay nut, nen khong co
 * gi trong khuon bam duoc hay dung chan trong luot Tab.
 */
function KhuonTroi({ tenKia, caHai }: { tenKia: string; caHai: boolean }) {
  return (
    <div className={caHai ? "troi troi--cua-so troi-dai__khuon" : "troi troi-dai__khuon"} aria-hidden="true" inert>
      <div className="shell troi__chu">
        {caHai && (
          /* Cho trong cua o cua so: khong co no thi cot chu cua khuon rong hon cot chu that va khuon do thieu mot
             dong. Nhan lay ten nguoi kia chu khong lay chu "ban": khi ten du dai de quyet dinh be rong o thi no luon
             dai hon "Trời của bạn", con khi no ngan thi ca hai deu hep hon o kinh nen be rong khong doi. */
          <span className="cua-so">
            <span className="cua-so__o"><span className="cua-so__kinh" /></span>
            <span className="cua-so__chu troi__phu">
              {`Trời của ${tenKia}`}
              <span className="cua-so__gio">00:00</span>
            </span>
          </span>
        )}
        <div className="troi__noi">
          <p className="troi__ai troi__phu">Bạn</p>
          <div className="troi-dai__chong">
            {WEATHERS.map((w) => (
              <div key={w}>
                <p className="troi__dong troi__tho d">
                  {TROI[w].tho.map((cau) => <span key={cau} className="troi__cau">{cau}</span>)}
                </p>
                {TROI[w].giai !== null && <p className="troi__giai troi__phu">{TROI[w].giai}</p>}
                <p className="troi__nguon troi__phu">{TROI[w].nguon}</p>
                <p className="troi__nhan">{NHAN_KHUON}</p>
              </div>
            ))}
          </div>
          {/* Gio tha viet bang chu so 0: `.troi__gio` khong dung chu so cung be rong, ma 0 khong hep hon chu so nao. */}
          <p className="troi__cuoi">
            <span className="troi__gio troi__phu">Thả lúc 00:00</span>
            <span className="btn btn--chu"><Hoa weather="nang-am" />Xem lịch hoa</span>
            <span className="btn btn--chu nut-cho">Tạm dừng hiệu ứng</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/** Mot bau troi: nen, hai cau tho, nguon, loi nhan, luc tha; o cua so dung truoc phan chu. */
function MotTroi({ m, an, cu, cuaSoCu = null, dung, doiDung }: {
  m: Mat;
  an: boolean;
  /** Trai troi cu trong lan loang: nam duoi troi moi, tro nang, va se bi go o buoc don. */
  cu?: boolean;
  /** Troi cu cua o cua so trong lan loang: mot o kinh nua nam duoi o kinh moi, cung o luoi, go o buoc don. */
  cuaSoCu?: TroiHien | null;
  dung: boolean;
  doiDung: () => void;
}) {
  const t = TROI[m.troi.weather];
  return (
    <section
      className={`troi troi--${m.troi.weather}${m.cuaSo ? " troi--cua-so" : ""}${an ? " troi--an" : ""}${cu ? " troi--cu" : ""}`}
      // Trai troi cu khong mang data-mat: song.ts tim hai mat cua lan doi cho bang dung thuoc tinh nay, va trai troi cu
      // khong phai mot mat - no chi nam do cho lop loang phu len roi bien mat.
      data-mat={!cu && m.cuaSo ? m.ten : undefined}
      data-k={m.troi.weather}
      data-bao={m.bao}
      aria-label={`Tâm trạng của ${m.ai}`}
      inert={an || cu || undefined}
      aria-hidden={an || cu || undefined}
    >
      <div className="troi__nen" aria-hidden="true">
        <NetTroi weather={m.troi.weather} />
      </div>
      <div className="shell troi__chu">
        {m.cuaSo && (
          <button type="button" className="cua-so" aria-label={`Xem trời của ${m.aiCuaSo}`}>
            {/* Hai o kinh xep chong trong CUNG mot o luoi khi dang loang: kinh cu nam duoi, kinh moi nam tren va lan
                loang chay ben trong no. The boc nay khong duoc dinh vi, nen offsetLeft/offsetTop cua o kinh van do tu
                .cua-so y nhu truoc - song.ts do bo cuc cua lan doi cho bang chinh hai so do (phat hien N2). */}
            <span className="cua-so__o">
              {cuaSoCu !== null && (
                <span className={`cua-so__kinh cua-so__kinh--cu troi--${cuaSoCu.weather}`} aria-hidden="true">
                  <span className="cua-so__nen"><NetTroi weather={cuaSoCu.weather} /></span>
                  <Hoa weather={cuaSoCu.weather} className="cua-so__hoa" />
                </span>
              )}
              <span className={`cua-so__kinh troi--${m.cuaSo.weather}`} data-k={m.cuaSo.weather} aria-hidden="true">
                <span className="cua-so__nen"><NetTroi weather={m.cuaSo.weather} /></span>
                <Hoa weather={m.cuaSo.weather} className="cua-so__hoa" />
              </span>
            </span>
            <span className="cua-so__chu troi__phu" aria-hidden="true">
              {`Trời của ${m.aiCuaSo}`}
              <span className="cua-so__gio">{m.cuaSo.gio}</span>
            </span>
          </button>
        )}
        <div className="troi__noi">
          <p className="sr-only">{`${m.laMinh ? "Bạn" : m.ai}: ${t.ten}.`}</p>
          {m.laMinh && <p className="troi__ai troi__phu">Bạn</p>}
          <p className="troi__dong troi__tho d">
            {t.tho.map((cau) => <span key={cau} className="troi__cau">{cau}</span>)}
          </p>
          {t.giai !== null && <p className="troi__giai troi__phu">{t.giai}</p>}
          <p className="troi__nguon troi__phu">{t.nguon}</p>
          {m.troi.note !== null && <p className="troi__nhan">{m.troi.note}</p>}
          <p className="troi__cuoi">
            <span className="troi__gio troi__phu">{m.troi.tha}</span>
            <Link className="btn btn--chu" href="/tam-trang"><Hoa weather={m.troi.weather} />Xem lịch hoa</Link>
            {/* Nhan doi theo viec sap lam, khong dung aria-pressed: mot nut mot viec, doc len la biet bam se duoc gi.
                Nut nay dung MOI hieu ung tu chay cua trang, khong rieng bau troi (phan quyet B4). */}
            <button type="button" className="btn btn--chu nut-dung" onClick={doiDung}>
              {dung ? "Cho hiệu ứng chạy" : "Tạm dừng hiệu ứng"}
            </button>
          </p>
        </div>
      </div>
    </section>
  );
}

/** Troi cu dang duoc phu trong mot lan loang, va no dang o mat nao: dai lon hay o cua so. */
type TroiCu = { troi: TroiHien; lon: boolean };

/**
 * Hai bau troi co khac nhau khong. So tung truong chu khong so tham chieu: may chu dung lai mot doi tuong moi moi lan
 * ve, nen hai lan ve giong het nhau van la hai doi tuong khac.
 *
 * KHONG so `tha`: chuoi do la "Tha luc 08:15" hay "Tha luc 08:15 hom qua" tuy HOM NAY la ngay nao, nen mot lan lam moi
 * vat qua nua dem se bao "da thay" du khong ai tha gi. `gio` moi la moc that cua lan tha (timeLabel cua setAt), nen
 * tha lai dung kieu troi va dung loi nhan cu o mot phut khac van duoc tinh la mot lan thay (phat hien N12).
 */
function khacTroi(a: TroiHien | null, b: TroiHien | null): boolean {
  if (a === null || b === null) return a !== b;
  return a.weather !== b.weather || a.note !== b.note || a.gio !== b.gio;
}

/**
 * Cac the ma lan loang can, tren mat dang mang troi cua nguoi vua tha. Tra ve null khi khong tim thay du the: luc do
 * nguoi goi trao thang chu khong loang - tha mot lan bam hong hon la ve sai.
 *
 * Nhanh dai lon: bo chon neo vao `[data-k]` de bo qua khuon giu cho chieu cao (khuon cung mang lop `troi` nhung khong
 * co data-k), bo qua trai troi cu, va bo qua mat dang bi cat ve 0 o che do o cua so.
 */
function matLoang(w: HTMLElement, cu: TroiCu): MatLoang | null {
  if (!cu.lon) {
    /*
     * Troi cua nguoi xem dang thu nho trong o cua so cua mat nguoi kia, nen lan loang chay trong chinh o kinh do:
     * cung mot ngon ngu hinh o moi noi (yeu cau diem 20). Mat "kia" la mat dang lon nen no khong mang troi--an; bo
     * chon viet ca dieu do ra de neu mot ngay nao do no khong con dung, lan loang bo qua chu khong ve nham cho.
     *
     * Khuon vet co theo canh ngan cua o (khuonO), nen day la vai chuc vet chu khong phai ca tram nhu o dai lon.
     */
    const kinh = w.querySelector<HTMLElement>(
      ".troi[data-mat=\"kia\"]:not(.troi--an) .cua-so__o > .cua-so__kinh:not(.cua-so__kinh--cu)",
    );
    if (kinh === null) return null;
    // O kinh to nen bang CHINH no chu khong bang mot the con, nen tat nen bang mot lop chu khong bang opacity: dat
    // opacity 0 len o kinh la giau luon may chuc vet nuoc nam ben trong no (cung mot ly le voi phan quyet M1).
    kinh.classList.add("cua-so__kinh--loang");
    return {
      khung: kinh,
      kieu: kinh.dataset.k ?? "",
      // Net ve thu nho va bong hoa ep deu hien lai theo nhip cua chung tren nen vet nuoc. CSS day ca hai len tren lop
      // loang: de nguyen thi chung nam duoi may chuc vet nuoc va chi bat ra mot luot o buoc don (phat hien N3).
      net: [...kinh.querySelectorAll<HTMLElement>(".cua-so__nen .m, .cua-so__hoa")],
      // O kinh khong chua dong chu nao: chu "Troi cua ban" va gio tha nam ngoai o kinh.
      chuMoi: [],
      chuCu: [],
      nho: true,
    };
  }
  const moi = w.querySelector<HTMLElement>(".troi[data-k]:not(.troi--cu):not(.troi--an)");
  const cuEl = w.querySelector<HTMLElement>(".troi--cu");
  if (moi === null || cuEl === null) return null;
  // Lop nay phai co TRUOC khi loangTroi chay (no tat nen chuyen sac de may chuc vet nuoc to thay), va chi duoc go
  // trong chinh `xong` - cung mot luot voi luc go lop loang, neu khong nen that tro lai som mot khung hinh.
  moi.classList.add("troi--dang-loang");
  return {
    khung: w,
    kieu: moi.dataset.k ?? "",
    net: [...moi.querySelectorAll<HTMLElement>(".troi__nen .m")],
    chuMoi: dongChu(moi),
    chuCu: dongChu(cuEl),
    nho: false,
  };
}

/**
 * Go dau "dang loang" cua dai troi. Mot cau go duoc dau cua ca hai nhanh: dai lon danh dau tren chinh bau troi moi, o
 * cua so danh dau tren o kinh moi, va khong bao gio co ca hai cung luc.
 */
function goDauLoang(w: HTMLElement): void {
  w.querySelector(".troi--dang-loang, .cua-so__kinh--loang")
    ?.classList.remove("troi--dang-loang", "cua-so__kinh--loang");
}

/**
 * Dai troi o dau ke sach, che do "O cua so" cua ban mau da duyet. Mac dinh la mot bau troi lon cua nguoi kia; khi nguoi
 * xem cung dang giu tam trang, mot o cua so tron nho mang troi cua ho (thu nho, van chuyen dong, kem bong hoa ep).
 *
 * Dai troi luon la mot the boc `.troi-dai`, ke ca khi chi mot nguoi giu tam trang: moi bau troi va khuon giu cho deu
 * nam trong CUNG mot o luoi cua no. Chieu cao dai vi vay bang phan tu cao nhat trong o - ma khuon giu cho luon la cai
 * cao nhat - nen no khong doi khi doi cho hai troi, cung khong doi khi thay mot tam trang, va khong co gi ben duoi bi
 * xo dich (spec muc 2 luat 2). Bam vao o cua so thi hai troi doi cho bang mot vong song nuoc
 * lan tu tam o (src/components/tam-trang/song.ts): chi bat/tat lop va chay hoat hinh, khong dung lai cay DOM. Giam
 * chuyen dong thi doi ngay, khong co lop song nao. Focus o yen tren o cua so, vung aria-live bao troi dang xem, bam
 * trong luc song dang lan bi bo qua. Trang thai doi cho chi o trinh duyet, khong luu, khong tu xoay vong.
 *
 * Chi mot nguoi co tam trang thi khong co o cua so; neu la cua chinh nguoi xem thi troi lon mang nhan "Ban". Hai cau tho
 * khong co ten nguoi; ten nguoi va kieu troi chi doc cho trinh doc man hinh.
 *
 * THAY mot tam trang thi khac DOI CHO hai bau troi: sau refresh() cua ThaTamTrang, props tu may chu doi, mot layout
 * effect nhan ra chinh tam trang cua nguoi xem vua bi thay va giu troi cu lai trong state. Troi cu duoc ve them thanh
 * mot trai nam trong cung o luoi (`.troi--cu`, inert, aria-hidden), roi troi moi loang ra phu len no bang may chuc vet
 * nuoc (src/components/tam-trang/loang.ts, spec muc 3.4). Troi cu chi bi go o buoc don, trong dung mot luot voi lop
 * loang, nen khong khung hinh nao lot vao giua. Giam chuyen dong thi trao thang, khong lop loang nao.
 *
 * "Mat nao dang lon" co dung MOT nguon su that, la ref `matLon` do song.ts bao nguoc len (phan quyet M2). Khong noi
 * nao duoc doc lop `troi--an` ra de suy trang thai do: `class` thuoc ve React, moi lan doi tam trang React ghi lai ca
 * chuoi tu JSX, nen thu doc duoc luon la gia tri JSX vua ghi de chu khong phai lan doi cho cua nguoi dung.
 *
 * "Xem lich hoa" hien o CA HAI mat, ke ca troi cua chinh nguoi xem (yeu cau dot ba diem 3, spec muc 5): lich hoa la
 * cua ca hai nguoi nen khong co ly do doi chu hay giau di. Nhan luon la "Xem lich hoa", bong hoa ep mang mau muc cua
 * kieu troi dang hien. Nho vay hang cuoi (.troi__cuoi) cua hai mat cao bang nhau.
 *
 * Nut "Tam dung hieu ung" nam trong hang cuoi da co san (.troi__cuoi), nen no khong xo dich gi cua ban mau da duyet.
 * Chuyen dong nen cua bau troi tu bat dau, keo dai qua 5 giay va o song song voi noi dung khac - dung ba dieu kien cua
 * WCAG SC 2.2.2, ma ngoai le "essential" khong dung duoc o day (chinh nhanh giam chuyen dong chung minh: bau troi dung
 * yen van dep va van du nghia). Nut bat lop `troi-dung` tren dai troi, lop do dung MOI net ve cua ca hai mat. Lua chon
 * duoc luu va doc lai qua useTamDung (src/components/hieu-ung/tam-dung.ts), dung chung voi bia tu doi cua khung sach
 * lon o plan sau: mot cong tac cho moi hieu ung tu chay, theo phan quyet B4. Khi nguoi dung xin giam chuyen dong thi
 * khong con gi chay, nen nut duoc giau han bang CSS (tam-trang.css, nhanh prefers-reduced-motion).
 */
export function BauTroi({ tenKia, kia, minh }: { tenKia: string; kia: TroiHien | null; minh: TroiHien | null }) {
  const dai = useRef<HTMLElement | null>(null);
  const dangDung = useRef(false);
  /*
   * Nguon su that DUY NHAT cho "mat nao dang lon" (phan quyet M2). Lan doi cho chay thang tren DOM de khung hinh dau
   * co ngay khi ngon tay an xuong, nhung thuoc tinh `class` lai thuoc ve React: moi lan doi tam trang React ghi lai
   * ca chuoi class tu JSX, ma trong JSX mat "minh" luon nhan `an`. Doc lop `troi--an` ra de suy trang thai la doc
   * dung gia tri vua bi ghi de. Nen song.ts bao nguoc len ref nay, va apMatLon dat lai DOM theo no sau moi lan ve.
   */
  const matLon = useRef("kia");
  const [bao, setBao] = useState("");
  const [cu, setCu] = useState<TroiCu | null>(null);
  /** Hai bau troi cua lan ve gan nhat, de nhan ra CHINH tam trang cua nguoi xem vua bi thay. */
  const daVe = useRef({ kia, minh });
  const caHai = kia !== null && minh !== null;
  const batDai = useCallback((el: HTMLElement | null) => {
    dai.current = el;
  }, []);

  /*
   * Duong DUY NHAT dat lop `troi-dung` len dai troi, va no dat bang classList chu khong qua className cua JSX: song.ts
   * cung sua lop cua CHINH phan tu nay (troi-cua-so--san, troi--an), ma React ghi de ca thuoc tinh class moi lan gia
   * tri className doi - tuc mot lan bam tam dung se xoa mat lop do song.ts vua dat.
   *
   * Ham nay chay dong bo trong chinh layout effect cua useTamDung, tuc truoc khi trinh duyet ve khung hinh dau: lop
   * moi la thu quyet dinh bau troi co chay hay khong, con nhan cua nut chi doi theo o vong ve lai sau do.
   */
  const apDung = useCallback((v: boolean) => {
    dangDung.current = v;
    dai.current?.classList.toggle("troi-dung", v);
  }, []);
  const [dung, datDung] = useTamDung(apDung);

  /**
   * Dat lai "mat nao dang lon" len DOM theo ref. Goi trong layout effect, tuc sau khi React ghi xong thuoc tinh class
   * va truoc khi trinh duyet ve, nen mot lan thay tam trang khong the am tham keo hai bau troi ve cho cu. Dat ca inert
   * va aria-hidden: rieng lop thi troi dang bi cat ve 0 van bam duoc va van doc duoc.
   */
  const apMatLon = useCallback(() => {
    const w = dai.current;
    if (w === null) return;
    const mat = [...w.querySelectorAll<HTMLElement>(".troi[data-mat]")];
    if (mat.length === 0) {
      // Chi mot nguoi giu tam trang: khong co o cua so nen khong co lan doi cho nao, lua chon cu het nghia.
      matLon.current = "kia";
      return;
    }
    for (const sec of mat) {
      const an = sec.dataset.mat !== matLon.current;
      sec.classList.toggle("troi--an", an);
      sec.toggleAttribute("inert", an);
      if (an) sec.setAttribute("aria-hidden", "true");
      else sec.removeAttribute("aria-hidden");
    }
  }, []);

  // Phu thuoc caHai chu khong phai mang rong: dai co o cua so chi ton tai khi ca hai cung giu tam trang, va so nguoi
  // dang giu tam trang doi ngay trong lan song lai (sau khi tha hay thu lai) ma thanh phan khong bi dung lai. Gan mot
  // lan duy nhat luc vao cay thi di tu mot troi sang hai troi se de nut o cua so khong co tay nghe nao, bam khong an.
  useEffect(() => {
    const w = dai.current;
    return w === null || !caHai ? undefined : ganSong(w, (ten) => {
      matLon.current = ten;
    });
  }, [caHai]);

  // Moi lan hai bau troi doi (React ghi lai thuoc tinh class tu JSX) thi dat lai mat dang lon theo ref.
  useLayoutEffect(() => {
    apMatLon();
  }, [apMatLon, caHai, kia, minh]);

  /*
   * Nhan ra lan thay tam trang. Layout effect chu khong phai passive effect: no phai chay TRUOC khi trinh duyet ve, de
   * troi moi khong kip hien ra voi nen day du roi mot nhip sau moi bat dau loang.
   *
   * Chi tam trang cua CHINH nguoi xem moi co lan loang, va chi khi no bi THAY: tha lan dau hay thu lai la dai troi
   * hien ra hay bien mat han chu khong phai thay mot bau troi. So bau troi tren dai cung phai giu nguyen: khi no doi,
   * ham go cua ganSong chay va huy moi hen gio dang cho, tuc lan loang bat dau o day se khong bao gio duoc don.
   */
  useLayoutEffect(() => {
    const truoc = daVe.current;
    if (!khacTroi(truoc.kia, kia) && !khacTroi(truoc.minh, minh)) return;
    daVe.current = { kia, minh };
    if (truoc.minh === null || minh === null || !khacTroi(truoc.minh, minh)) return;
    if ((truoc.kia === null) !== (kia === null) || giamChuyenDong()) return;
    // Dat trang thai ngay trong effect la dung viec ma luat "khong setState trong effect" cho phep: dong bo voi mot he
    // thong ngoai (props vua ve tu may chu). Trai troi cu phai co trong cay ngay o luot nay thi lan loang moi co cai
    // de phu len.
    setCu({ troi: truoc.minh, lon: !caHai || matLon.current === "minh" });
  }, [caHai, kia, minh]);

  /*
   * So bau troi tren dai vua doi GIUA lan loang: nguoi kia vua tha tam trang cua ho, hay vua thu no lai. Ham go cua
   * effect theo `caHai` o duoi huy moi hen gio cua dai troi, ke ca cai hen don dep cua lan loang, nen khong go tay o
   * day thi lop vet nuoc, dau "dang loang" va trai troi cu con nam lai trong cay toi tan lan thay tam trang sau.
   *
   * Dat TRUOC effect chay lan loang: mot lan loang khong bao gio bat dau o dung luot `caHai` doi (effect nhan ra lan
   * thay tam trang bo qua luot do), nhung neu mot ngay nao do no co, thu tu nay dam bao lan loang moi khong bi chinh
   * cau go nay huy ngay khi vua dung xong.
   */
  useLayoutEffect(() => {
    const w = dai.current;
    if (w === null || !huyLoang(w)) return;
    goDauLoang(w);
    // Tra trang thai ve nhu sau mot lan loang binh thuong: tam trang moi van hien du, chi la trao thang thay vi loang
    // not - dung cai ma nhanh giam chuyen dong lam.
    setCu(null);
  }, [caHai]);

  /*
   * Chay lan loang. Effect nay chay o lan commit da co CA hai bau troi trong cay, va van truoc khi trinh duyet ve, nen
   * khung hinh dau tien da la khung hinh co vet nuoc.
   */
  useLayoutEffect(() => {
    const w = dai.current;
    if (cu === null || w === null) return;
    const mat = matLoang(w, cu);
    if (mat === null) {
      // Khong loang duoc (troi cua nguoi xem dang o o cua so, hay thieu the): tra trang thai ve khong de lan thay tam
      // trang sau con nhan ra duoc.
      setCu(null);
      return;
    }
    // O nhung nhanh loangTroi bo qua lan loang (giam chuyen dong, khung chua do duoc), `xong` chay DONG BO ngay tai
    // day: goi flushSync tu trong mot lifecycle thi React in canh bao, ma luc do cung khong co khung hinh nao de giu.
    let dongBo = true;
    loangTroi(w, mat, () => {
      goDauLoang(w);
      // flushSync de React go trai troi cu NGAY trong luot nay: de vong ve lai binh thuong thi giua luc go lop loang
      // va luc go troi cu se lot mot khung hinh co ca hai.
      if (dongBo) setCu(null);
      else flushSync(() => setCu(null));
    });
    dongBo = false;
  }, [cu]);

  // Roi trang giua luc dang loang: huy sach hen gio va hoat hinh cua dai troi. ganSong chi gan khi ca hai cung giu tam
  // trang, nen khong the tin vao ham go cua no.
  useEffect(() => {
    const w = dai.current;
    return () => {
      if (w !== null) goViec(w);
    };
  }, [caHai]);

  // Tu mot bau troi sang hai bau troi (hay nguoc lai) thi the boc dai troi la mot phan tu MOI, chua mang lop nao: dat
  // lai lop theo lua chon dang giu, neu khong nguoi da tam dung se thay hieu ung chay lai ma ho khong bam gi. Doc ref
  // chu khong doc `dung`: o lan commit dau tien, useTamDung da dat lop tu localStorage nhung `dung` van con la false.
  useLayoutEffect(() => {
    apDung(dangDung.current);
  }, [apDung, caHai]);

  function doiDung() {
    const moi = !dung;
    datDung(moi);
    setBao(moi ? "Hiệu ứng đã tạm dừng." : "Hiệu ứng chạy lại rồi.");
  }

  if (kia === null && minh === null) return null;
  const matKia: Mat | null = kia === null ? null : {
    ten: "kia", troi: kia, cuaSo: minh, ai: tenKia, aiCuaSo: "bạn", laMinh: false, bao: `Đang xem trời của ${tenKia}.`,
  };
  const matMinh: Mat | null = minh === null ? null : {
    ten: "minh", troi: minh, cuaSo: kia, ai: "bạn", aiCuaSo: tenKia, laMinh: true, bao: "Đang xem trời của bạn.",
  };
  // Vung bao cua nut tam dung nam BEN TRONG dai troi, khong phai mot the anh em: quy tac khoang cach dau ke sach
  // (".troi-dai + .shell .ke-dau") doi dai troi la anh em LIEN KE ngay truoc .shell, chen bat ky the nao vao giua la
  // khoang cach dau ke sach bat ngo gian ra.
  //
  // Khuon giu cho ve SAU cac bau troi: no khong ve gi ra man hinh nen thu tu ve khong quan trong, nhung moi bo chon
  // ".troi ..." khong neo vao [data-mat] deu tim thay bau troi that truoc (bai kiem va song.ts deu dua vao dieu nay).
  return (
    <div className={caHai ? "troi-dai troi-cua-so" : "troi-dai"} ref={batDai}>
      {/* O cua so cua mat nguoi kia luon mang troi cua chinh nguoi xem, nen trai troi cu cua mot lan loang nho nam o
          day. Mat "minh" khong bao gio can no: o cua so cua mat do mang troi cua nguoi kia, thu khong doi trong lan
          thay tam trang nay. */}
      {matKia !== null && (
        <MotTroi
          m={caHai ? matKia : { ...matKia, cuaSo: null }}
          an={false}
          cuaSoCu={cu !== null && !cu.lon ? cu.troi : null}
          dung={dung}
          doiDung={doiDung}
        />
      )}
      {matMinh !== null && <MotTroi m={caHai ? matMinh : { ...matMinh, cuaSo: null }} an={caHai} dung={dung} doiDung={doiDung} />}
      <KhuonTroi tenKia={tenKia} caHai={caHai} />
      {caHai && <p className="sr-only troi-cua-so__bao" aria-live="polite" />}
      {/* Bao rieng cho nut tam dung, khong dung chung voi .troi-cua-so__bao: o bao ay do song.ts dat textContent thang
          tren DOM, de React quan ly noi dung cua no la hai ben ghi de nhau. */}
      <p className="sr-only" aria-live="polite">{bao}</p>
      {/* Trai troi cu cua lan loang. No la con truc tiep cua dai troi nen nam trong DUNG o luoi cua cac bau troi
          (.troi-dai > .troi{ grid-area: 1 / 1 }): dai khong cao them roi thap di trong luc hai troi cung o tren trang.
          Ve sau cung vi thu tu ve do z-index quyet dinh chu khong do thu tu the, va dat cuoi thi React dung va go no
          ma khong dong toi mot the nao khac. */}
      {cu !== null && cu.lon && matMinh !== null && (
        <MotTroi m={{ ...matMinh, troi: cu.troi }} an={false} cu dung={dung} doiDung={doiDung} />
      )}
    </div>
  );
}
