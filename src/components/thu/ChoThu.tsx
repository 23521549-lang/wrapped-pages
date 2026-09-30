"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { actionMoThu } from "@/app/actions/thu";
import { choThu, type TrangThaiThu } from "@/lib/thu";
import { VietThu } from "./VietThu";

/** Su kien cua cua so: mot la thu vua duoc mo (o Lich hoa hay trong cua so doc thu); la thu troi nghe de an ngay. */
export const SU_KIEN_THU_DA_MO = "thu-da-mo";

/** Thu nguoi kia gui minh, nhu cho thu hien: chu va gio gui da dung san o may chu. */
export type ThuKiaHien = { noiDung: string; gio: string };

/** Phong thu nho cua dong cho. */
function PhongCho() {
  return (
    <svg viewBox="0 0 88 64" aria-hidden="true" focusable="false">
      <rect x="4" y="10" width="80" height="48" rx="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M4 14 44 40 84 14" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="44" cy="40" r="7" fill="var(--blue-1)" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

/**
 * Cho thu cua mot thang o Lich hoa (spec 5b E3), luon chi mot thu: to giay de viet (minh chua gui, ke ca khi nguoi kia da
 * gui), thu nguoi kia gui minh (ca hai da gui), hay dong cho (minh da gui, nguoi kia chua). Thu cua chinh minh khong bao
 * gio co o day (may chu khong tra ve). Thu nguoi kia chua mo ma o thang dang mo thi ghi da mo mot lan.
 */
export function ChoThu({ thang, tenThangChu, tenKia, tenMinh, tt, kia, chuaMo, mo }: {
  thang: string;
  tenThangChu: string;
  tenKia: string;
  tenMinh: string;
  tt: TrangThaiThu;
  kia: ThuKiaHien | null;
  chuaMo: boolean;
  /** O thang dang tha xuong. */
  mo: boolean;
}) {
  const router = useRouter();
  const cai = choThu(tt);
  const daGhi = useRef(false);
  useEffect(() => {
    if (cai !== "doc" || !chuaMo || !mo || daGhi.current) return;
    daGhi.current = true;
    void actionMoThu(thang).then((r) => {
      if ("thu" in r) globalThis.dispatchEvent(new CustomEvent(SU_KIEN_THU_DA_MO, { detail: thang }));
    }, () => {
      daGhi.current = false;
    });
  }, [cai, chuaMo, mo, thang]);

  if (cai === "viet") {
    return <VietThu thang={thang} tenKia={tenKia} tenThangChu={tenThangChu} daGui={() => router.refresh()} />;
  }
  if (cai === "cho" || kia === null) {
    return (
      <div className="thu-la thu-la--dong">
        <PhongCho />
        <p><b>{`Thư của bạn đã tới tay ${tenKia}.`}</b>{` Khi ${tenKia} viết, thư sẽ bay tới góc trên màn hình của bạn.`}</p>
      </div>
    );
  }
  return (
    <article className="thu-la" aria-label={`Thư ${tenThangChu} của ${tenKia}`}>
      <p className="thu-la__gui">{`Gửi ${tenMinh},`}</p>
      <p className="thu-la__than">{kia.noiDung}</p>
      <p className="thu-la__ky">{tenKia}</p>
      <p className="thu-la__gio">{`${tenKia} gửi ${kia.gio}`}</p>
    </article>
  );
}
