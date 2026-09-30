"use client";

import { useEffect, useEffectEvent } from "react";
import { OPhat, useNhacChung, type HangDoi } from "@/components/music/MayPhatChung";

/** Mot bai trong so, da dung san chu o may chu. nguon: "Chuyện chưa kể, lượt 2", ", riêng tư" khi cuon rieng tu. */
export type BaiSoHien = { key: string; youtubeId: string; ten: string; kenh: string | null; nguon: string };
/** Mot danh sach phat: "Của Linh", so bai; bai theo luc dat. */
export type DanhSachHien = { khoa: string; ten: string; bai: BaiSoHien[] };

function TamGiac() {
  return <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><path d="M6 3.8v12.4a.6.6 0 0 0 .9.5l9.8-6.2a.6.6 0 0 0 0-1L6.9 3.3a.6.6 0 0 0-.9.5Z" fill="currentColor" /></svg>;
}
function HaiVach() {
  return <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false"><rect x="5" y="4" width="3.4" height="12" rx="1" fill="currentColor" /><rect x="11.6" y="4" width="3.4" height="12" rx="1" fill="currentColor" /></svg>;
}

/**
 * So nhac mot thang (spec 5b B3): khung phat YouTube o chinh giua (o giu cho cua trinh phat chung), dong dang phat duoi
 * khung, cac danh sach phat canh nhau. Nut tron tam giac cua moi danh sach phat tu bai dau (dang phat thi thanh tam dung);
 * bam mot bai la phat tu bai do. Phat tuan tu, het danh sach thi sang danh sach ke, vong lai, het ca thi dung. Roi trang
 * ma dang nghe thi nhac di theo o cua so nho.
 */
export function SoNhac({ thang, href, ds }: { thang: string; href: string; ds: readonly DanhSachHien[] }) {
  const nhac = useNhacChung();
  const chu = `so-${thang}`;
  const hang: HangDoi = {
    chu, nhan: thang, href,
    ds: ds.map((d) => d.bai.map((b) => ({ youtubeId: b.youtubeId, ten: b.ten, kenh: b.kenh }))),
  };
  const cuaSo = nhac.hang?.chu === chu;
  const vt = cuaSo ? nhac.vt : null;
  const chay = vt !== null && nhac.trangThai === "phat";

  // Vua mo trang: nap san bai dau cho khung lon (khong phat), neu khong co gi dang nghe.
  const napSan = useEffectEvent(() => nhac.chuanBi(hang));
  useEffect(() => {
    napSan();
  }, []);

  const bai = vt === null ? null : ds[vt.ds]?.bai[vt.bai];
  const trangThai = nhac.trangThai === "loi" ? "Không phát được" : nhac.trangThai === "tai" ? "Đang nạp" : chay ? "Đang phát" : "Tạm dừng";
  return (
    <div className="sn">
      <div className="sn__phat">
        <OPhat chu={chu} className="sn__may">
          {nhac.hang !== null && !cuaSo && <p>Nhạc khác đang phát ở góc dưới. Bấm tam giác để nghe sổ này.</p>}
        </OPhat>
        <p className="sn__dang" aria-live="polite">
          {bai !== null && vt !== null && (
            <>
              {`${trangThai} `}<b>{bai.ten}</b>{`${bai.kenh === null ? "" : `, ${bai.kenh}`}. ${ds[vt.ds].ten}, bài ${vt.bai + 1} trên ${ds[vt.ds].bai.length}.`}
            </>
          )}
        </p>
      </div>
      <div className="pl-ds">
        {ds.map((d, i) => {
          const dsNay = vt?.ds === i;
          const dsChay = dsNay && chay;
          return (
            <section key={d.khoa} className={dsNay ? "pl pl--dang" : "pl"} aria-labelledby={`pl-${d.khoa}`}>
              <div className="pl__dau">
                {d.bai.length > 0 && (
                  <button
                    type="button"
                    className="pl__phat"
                    aria-label={`${dsChay ? "Tạm dừng" : "Phát"} ${d.ten}`}
                    onClick={() => {
                      if (dsChay) nhac.tam();
                      else if (dsNay) nhac.choi();
                      else nhac.phatTu(hang, { ds: i, bai: 0 });
                    }}
                  >
                    {dsChay ? <HaiVach /> : <TamGiac />}
                  </button>
                )}
                <p className="pl__ten" id={`pl-${d.khoa}`}>
                  <b>{d.ten}</b>
                  <span>{d.bai.length === 0 ? "Chưa đặt bài nào trong tháng" : `${d.bai.length} bài trong tháng`}</span>
                </p>
              </div>
              {d.bai.length > 0 && (
                <ol className="pl__bai">
                  {d.bai.map((b, j) => {
                    const dang = dsNay && vt?.bai === j;
                    const lop = dang ? (chay ? "bai bai--dang bai--chay" : "bai bai--dang") : "bai";
                    return (
                      <li key={b.key}>
                        <button type="button" className={lop} aria-current={dang ? "true" : undefined} onClick={() => nhac.phatTu(hang, { ds: i, bai: j })}>
                          <span className="bai__so">
                            {dang ? <span className="song" aria-hidden="true"><i /><i /><i /></span> : j + 1}
                          </span>
                          <span className="bai__chu">
                            <span className="bai__ten">{b.ten}</span>
                            <span className="bai__phu">{b.kenh === null ? b.nguon : `${b.kenh}, ${b.nguon}`}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
