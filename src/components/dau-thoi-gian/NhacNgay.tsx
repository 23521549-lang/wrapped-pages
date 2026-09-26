"use client";

import { useImperativeHandle, useRef, useState, type Ref } from "react";
import { useMayPhatDanhSach, type TrangThaiMay } from "@/components/music/useMayPhatDanhSach";
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
   * Bam mot ngay. `cungNgay`: bam lai dung ngay dang chon - dang co bai thi phat tiep, khong phat lai tu dau. Ngay khac:
   * dung bai cu, phat tuan tu tu bai dau cua ngay moi (ngay khong co bai phat duoc thi chi dung).
   */
  chonNgay: (ds: readonly BaiNgay[], cungNgay: boolean) => void;
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

/**
 * The "Nhạc trong ngày" cua cot phai (spec bo sung B4 ban hai): khung phat YouTube, dong dang phat, nut Phat/Tam dung
 * va Bai ke tiep, danh sach bai cua ngay theo thu tu luot. Nhac CHI tu phat khi nguoi dung bam mot ngay (lich goi
 * chonNgay); xem bia hay doi thang khong dung toi nhac. Het bai thi sang bai ke, bai hong thi bo qua. Ngay khong co bai
 * nao phat duoc thi khong co trinh phat nao (khong phai trinh phat an).
 */
export function NhacNgay({ ds, ref, khungRef, noi }: {
  ds: readonly BaiNgay[];
  ref: Ref<DieuKhienNhac>;
  /** Khung cua the: lich do chieu cao va giu no ngoai lop inert khi the noi len tren trinh xem bia. */
  khungRef: Ref<HTMLElement>;
  /** Trinh xem bia dang mo va the nay dang noi o goc: thu gon danh sach. */
  noi: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  /** Vi tri bai dang nap hay dang phat trong ds; null la chua phat bai nao. */
  const [dang, setDang] = useState<number | null>(null);
  const [trangThai, setTrangThai] = useState<TrangThaiMay | "tai">("tai");
  /** Tang len de tao lai trinh phat sau khi nap API hong. */
  const [lanTao, setLanTao] = useState(0);
  const dau = baiPhatDuoc(ds, 0);
  const coMay = dau >= 0;

  const phatTu = (danhSach: readonly BaiNgay[], tu: number) => {
    const k = baiPhatDuoc(danhSach, tu);
    if (k < 0) {
      may.ngung();
      setDang(null);
      setTrangThai((t) => (t === "loi" ? t : "dung"));
      return;
    }
    setDang(k);
    may.nap(danhSach[k].youtubeId ?? "");
  };

  const may = useMayPhatDanhSach(hostRef, coMay ? `may-${lanTao}` : null, coMay ? ds[dau].youtubeId : null, {
    doi: setTrangThai,
    ketThuc: () => phatTu(ds, (dang ?? -1) + 1),
    hong: () => phatTu(ds, (dang ?? -1) + 1),
  });

  useImperativeHandle(ref, () => ({
    chonNgay: (moi, cungNgay) => {
      if (cungNgay && dang !== null) return;
      // Chua co trinh phat (ngay truoc khong co nhac) thi mot trinh phat moi sap duoc tao: dang nap. Nap API hong thi
      // tao lai trinh phat de thu lan nua.
      if (!coMay || trangThai === "loi") setTrangThai("tai");
      if (trangThai === "loi") setLanTao((n) => n + 1);
      phatTu(moi, 0);
    },
  }));

  const soBai = ds.filter((b) => b.youtubeId !== null).length;
  const bai = dang === null ? null : ds[dang];
  const chay = bai !== null && trangThai === "phat";
  const ke = dang === null ? -1 : baiPhatDuoc(ds, dang + 1);
  const trangThaiChu = trangThai === "loi" ? "Không phát được" : trangThai === "tai" ? "Đang nạp" : chay ? "Đang phát" : "Tạm dừng";

  /** So thu tu hien cua moi bai phat duoc (o go nhac khong duoc danh so). */
  const thuTu = ds.map((_, i) => ds.slice(0, i + 1).filter((b) => b.youtubeId !== null).length);
  return (
    <section ref={khungRef} className={coMay ? "dtg-the dtg-nhac dtg-nhac--may" : "dtg-the dtg-nhac"} aria-labelledby="dtg-nhac-t">
      <h3 className="d" id="dtg-nhac-t">Nhạc trong ngày</h3>
      {coMay && <div className="dtg-nhac__may" ref={hostRef} />}
      {coMay ? (
        <div className="dtg-nhac__dang">
          <p className="dtg-nhac__chu" aria-live="polite">
            {bai === null ? (
              <>
                <b>{`${soBai} bài trong ngày`}</b>
                <span>{trangThai === "loi" ? "Không nạp được trình phát YouTube." : "Bấm Phát, hay chọn một bài."}</span>
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
                if (chay) may.tam();
                else if (dang === null) phatTu(ds, 0);
                else may.choi();
              }}
            >
              {chay ? "Tạm dừng" : "Phát"}
            </button>
            <button type="button" className="btn btn--quiet btn--icon" aria-label="Bài kế tiếp" disabled={ke < 0} onClick={() => phatTu(ds, ke)}>
              <BaiKe />
            </button>
          </div>
        </div>
      ) : (
        <p className="dtg-nhac__trong">{ds.length === 0 ? "Ngày này không đổi nhạc." : "Ngày này chỉ gỡ nhạc nền."}</p>
      )}
      {ds.length > 0 && !noi && (
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
                  onClick={() => phatTu(ds, i)}
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
