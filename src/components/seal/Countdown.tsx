"use client";

import { haiChuSo } from "@/lib/when";
import { useTimeLeft } from "./useTimeLeft";

/**
 * Dong ho dem nguoc cua hen gio. Cham 0 thi onDone (man doc goi router.refresh() de may chu quyet
 * theo dong ho cua no). So dung tabular-nums nen chu khong nhay khi doi so. role="timer" khong tu doc len
 * moi giay.
 */
export function Countdown({ opensAt, now, onDone }: { opensAt: Date; now: Date; onDone: () => void }) {
  const s = Math.ceil(useTimeLeft(opensAt, now, onDone) / 1000);
  const o = [
    { key: "ngay", so: String(Math.floor(s / 86_400)), don: "ngày" },
    { key: "gio", so: haiChuSo(Math.floor((s % 86_400) / 3600)), don: "giờ" },
    { key: "phut", so: haiChuSo(Math.floor((s % 3600) / 60)), don: "phút" },
    { key: "giay", so: haiChuSo(s % 60), don: "giây" },
  ];
  return (
    <div className="dem-nguoc" role="timer" aria-label="Thời gian còn lại tới lúc mở">
      {o.map((x) => (
        <div key={x.key} className="dem-nguoc__o">
          <span className="dem-nguoc__so">{x.so}</span>
          <span className="dem-nguoc__don">{x.don}</span>
        </div>
      ))}
    </div>
  );
}
