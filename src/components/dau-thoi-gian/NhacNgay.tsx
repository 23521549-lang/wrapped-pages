"use client";

import { useEffect, useEffectEvent, useImperativeHandle, type Ref } from "react";
import { OPhat, useNhacChung, type BaiPhat, type HangDoi } from "@/components/music/MayPhatChung";
import { baiPhatDuoc } from "@/lib/dau-thoi-gian";

/** Mot dau nhac cua ngay dang chon, da dung san o may chu. youtubeId null la o go nhac. */
export type BaiNgay = {
  key: string;
  youtubeId: string | null;
  /** Ten bai tu YouTube; null khi may chu khong lay duoc. */
  ten: string | null;
  kenh: string | null;
  /** "Lượt 5" hay "Lúc tạo sách". */
  tenLuot: string;
  gio: string;
};

/** Dieu khien tu lich: bam mot ngay thi goi chonNgay voi danh sach nhac cua ngay do, NGAY trong cu bam. */
export type DieuKhienNhac = {
  /**
   * Bam mot ngay (nhan: khoa ngay, "2026-09-15"). `cungNgay`: bam lai dung ngay dang chon - dang co bai thi phat tiep,
   * khong phat lai tu dau. Ngay khac: phat tuan tu tu bai dau cua ngay moi (ngay khong co bai phat duoc thi dung han nhac
   * cua cuon nay).
   */
  chonNgay: (ds: readonly BaiNgay[], nhan: string, cungNgay: boolean) => void;
};

/** Ten hien cua mot bai: ten lay tu YouTube, hay cau thay khi khong lay duoc. */
export const tenBai = (b: BaiNgay) => b.ten ?? "Bản nhạc trên YouTube";

function VachSong() {
  return (
    <span className="dtg-vach" aria-hidden="true">
      <i /><i /><i />
    </span>
  );
}

function BaiKe() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <path d="M5 4.5 L12 10 L5 15.5 Z M14 4.5 V15.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Cac bai phat duoc cua mot ngay (bo o go nhac), theo thu tu luot. */
const baiPhat = (ds: readonly BaiNgay[]): BaiPhat[] =>
  ds.flatMap((b) => (b.youtubeId === null ? [] : [{ youtubeId: b.youtubeId, ten: tenBai(b), kenh: b.kenh }]));

/**
 * Phan "Nhạc trong ngày" trong the cua cot phai: o giu cho khung phat (trinh phat chung dat len do), dong dang phat, nut
 * Phat/Tam dung va Bai ke tiep, danh sach bai cua ngay theo thu tu luot. Nhac CHI tu phat khi nguoi dung bam mot ngay
 * (lich goi chonNgay); doi thang khong dung toi nhac. Het bai thi sang bai ke, bai hong thi bo qua. Ngay khong co bai nao
 * phat duoc thi khong co trinh phat nao (khong phai trinh phat an). Nhac di theo khi roi trang (spec 5b C4): chu la
 * "dtg-<id cuon>", ve lai trang nay thi khung phat ve lai o giu cho.
 */
export function NhacNgay({ ds, nhan, chu, href, ref }: {
  ds: readonly BaiNgay[];
  /** Khoa ngay dang chon, "2026-09-15". */
  nhan: string;
  chu: string;
  href: string;
  ref: Ref<DieuKhienNhac>;
}) {
  const nhac = useNhacChung();
  const hangCua = (danhSach: readonly BaiNgay[], nhanNgay: string): HangDoi => ({ chu, nhan: nhanNgay, href, ds: [baiPhat(danhSach)] });
  const coMay = baiPhat(ds).length > 0;
  const cuaCuon = nhac.hang?.chu === chu;
  const cuaNgay = cuaCuon && nhac.hang?.nhan === nhan;
  /** Vi tri trong ds cua bai thu k trong hang doi (hang doi bo o go nhac). */
  const viTri = ds.flatMap((b, i) => (b.youtubeId === null ? [] : [i]));
  const dang = cuaNgay && nhac.vt !== null ? (viTri[nhac.vt.bai] ?? null) : null;
  const phatTu = (danhSach: readonly BaiNgay[], nhanNgay: string, i: number) => {
    const k = baiPhatDuoc(danhSach, i);
    if (k >= 0) nhac.phatTu(hangCua(danhSach, nhanNgay), { ds: 0, bai: danhSach.slice(0, k).filter((b) => b.youtubeId !== null).length });
  };

  // Vua mo trang ma ngay chon san co nhac: nap san bai dau (khong phat), neu khong co gi dang nghe.
  const napSan = useEffectEvent(() => {
    if (coMay) nhac.chuanBi(hangCua(ds, nhan));
  });
  useEffect(() => {
    napSan();
  }, []);

  useImperativeHandle(ref, () => ({
    chonNgay: (moi, nhanMoi, cungNgay) => {
      if (cungNgay && dang !== null) return;
      if (baiPhatDuoc(moi, 0) >= 0) phatTu(moi, nhanMoi, 0);
      // Ngay khong co nhac: dung han nhac cua cuon nay; nhac dang nghe tu trang khac thi de yen.
      else if (cuaCuon) nhac.tat();
    },
  }));

  const soBai = viTri.length;
  const bai = dang === null ? null : ds[dang];
  const trangThai = cuaCuon ? nhac.trangThai : "dung";
  const chay = bai !== null && trangThai === "phat";
  const ke = dang === null ? -1 : baiPhatDuoc(ds, dang + 1);
  const trangThaiChu = trangThai === "loi" ? "Không phát được" : trangThai === "tai" ? "Đang nạp" : chay ? "Đang phát" : "Tạm dừng";

  /** So thu tu hien cua moi bai phat duoc (o go nhac khong duoc danh so). */
  const thuTu = ds.map((_, i) => ds.slice(0, i + 1).filter((b) => b.youtubeId !== null).length);
  return (
    <section className="dtg-nhac" aria-labelledby="dtg-nhac-t">
      <h3 className="d" id="dtg-nhac-t">Nhạc trong ngày</h3>
      {coMay && (
        <OPhat chu={chu} className="dtg-nhac__may">
          {nhac.hang !== null && !cuaCuon && <p className="dtg-nhac__khac">Nhạc khác đang phát ở góc dưới. Bấm Phát để nghe nhạc của ngày này.</p>}
        </OPhat>
      )}
      {coMay ? (
        <div className="dtg-nhac__dang">
          <p className="dtg-nhac__chu" aria-live="polite">
            {bai === null ? (
              <>
                <b>{`${soBai} bài trong ngày`}</b>
                <span>{cuaCuon && trangThai === "loi" ? "Không nạp được trình phát YouTube." : "Bấm Phát, hay chọn một bài."}</span>
              </>
            ) : (
              <>
                <b>{tenBai(bai)}</b>
                <span>{`${trangThaiChu}, ${bai.tenLuot.toLowerCase()}`}</span>
              </>
            )}
          </p>
          <div className="dtg-nhac__nut">
            <button
              type="button"
              className="btn"
              onClick={() => {
                if (chay) nhac.tam();
                else if (dang === null) phatTu(ds, nhan, 0);
                else nhac.choi();
              }}
            >
              {chay ? "Tạm dừng" : "Phát"}
            </button>
            <button type="button" className="btn btn--quiet btn--icon" aria-label="Bài kế tiếp" disabled={ke < 0} onClick={() => phatTu(ds, nhan, ke)}>
              <BaiKe />
            </button>
          </div>
        </div>
      ) : (
        <p className="dtg-nhac__trong">{ds.length === 0 ? "Chọn một ngày có nốt nhạc trên lịch." : "Ngày này chỉ gỡ nhạc nền."}</p>
      )}
      {ds.length > 0 && (
        <ol className="dtg-bai-ds">
          {ds.map((b, i) => {
            if (b.youtubeId === null) {
              return (
                <li key={b.key}>
                  <div className="dtg-bai dtg-bai--go">
                    <span className="dtg-bai__so" />
                    <span className="dtg-bai__ten">Gỡ nhạc nền</span>
                    <span className="dtg-bai__phu">{`${b.tenLuot}, lúc ${b.gio}. Từ lượt này cuốn im lặng.`}</span>
                  </div>
                </li>
              );
            }
            const dangBai = i === dang;
            return (
              <li key={b.key}>
                <button
                  type="button"
                  className={dangBai ? (chay ? "dtg-bai dtg-bai--dang dtg-bai--chay" : "dtg-bai dtg-bai--dang") : "dtg-bai"}
                  aria-current={dangBai ? "true" : undefined}
                  onClick={() => phatTu(ds, nhan, i)}
                >
                  <span className="dtg-bai__so">{dangBai ? <VachSong /> : thuTu[i]}</span>
                  <span className="dtg-bai__ten">{tenBai(b)}</span>
                  <span className="dtg-bai__phu">{`${b.kenh === null ? "" : `${b.kenh}. `}${b.tenLuot}, lúc ${b.gio}`}</span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
