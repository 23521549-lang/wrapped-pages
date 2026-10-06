"use client";

import { useState, useTransition } from "react";
import { actionCaiDatChip, actionXoaChip } from "@/app/actions/chip";
import { XacNhan } from "@/components/viet-cung/XacNhan";

/**
 * Muc "Chíp" o Cai dat (5e, spec F2): hien Chip o cac trang, Chip tu chao va bao chuyen moi, xoa cuoc tro chuyen cua minh
 * (hoi lai mot lan, "Thôi" duoc focus). Luu ngay khi doi, trang lam moi de Chip o goc doi theo.
 */
export function CaiDatChip({ an, tuNoi, tenKia }: { an: boolean; tuNoi: boolean; tenKia: string }) {
  const [pending, batDau] = useTransition();
  const [daXoa, setDaXoa] = useState(false);
  // O danh dau doi ngay khi bam (khong cho trang lam moi); may chu luu trong nen.
  const [hien, setHien] = useState(!an);
  const [noi, setNoi] = useState(tuNoi);
  return (
    <section className="muc" aria-labelledby="cai-dat-chip">
      <h2 className="d muc__t" id="cai-dat-chip">Chíp</h2>
      <p className="muc__x">
        Chíp là bạn gà con ngồi góc dưới bên trái. Chíp chỉ nhắc tới những gì bạn vốn thấy trên web, và không kể chuyện bạn nói
        với Chíp cho {tenKia}.
      </p>
      <label className="o-chon">
        <input
          type="checkbox"
          checked={hien}
          disabled={pending}
          onChange={(e) => {
            const bat = e.target.checked;
            setHien(bat);
            batDau(() => actionCaiDatChip({ an: !bat }));
          }}
        />
        Hiện Chíp ở các trang
      </label>
      <label className="o-chon">
        <input
          type="checkbox"
          checked={noi}
          disabled={pending}
          onChange={(e) => {
            const bat = e.target.checked;
            setNoi(bat);
            batDau(() => actionCaiDatChip({ tuNoi: bat }));
          }}
        />
        Chíp tự chào và báo chuyện mới
      </label>
      <div className="chip-xoa">
        {daXoa ? (
          <output className="muc__x">Đã xóa cuộc trò chuyện với Chíp.</output>
        ) : (
          <XacNhan
            nut="Xóa cuộc trò chuyện"
            nutClass="btn btn--line"
            hoi="Xóa hết những gì bạn đã nói với Chíp?"
            dongY="Xóa hết"
            chay={async () => {
              const r = await actionXoaChip();
              if ("error" in r) return r;
              setDaXoa(true);
              return undefined;
            }}
          />
        )}
      </div>
    </section>
  );
}
