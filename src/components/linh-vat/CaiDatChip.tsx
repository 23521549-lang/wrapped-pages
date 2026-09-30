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
  return (
    <section className="muc" aria-labelledby="cai-dat-chip">
      <h2 className="d muc__t" id="cai-dat-chip">Chíp</h2>
      <p className="muc__x">
        Chíp là bạn gà con ngồi góc dưới bên trái. Chíp chỉ nhắc tới những gì bạn vốn thấy trên web, và không kể chuyện bạn nói
        với Chíp cho {tenKia}.
      </p>
      <label className="chon-chip">
        <input
          type="checkbox"
          checked={!an}
          disabled={pending}
          onChange={(e) => batDau(() => actionCaiDatChip({ an: !e.target.checked }))}
        />
        Hiện Chíp ở các trang
      </label>
      <label className="chon-chip">
        <input
          type="checkbox"
          checked={tuNoi}
          disabled={pending}
          onChange={(e) => batDau(() => actionCaiDatChip({ tuNoi: e.target.checked }))}
        />
        Chíp tự chào và báo chuyện mới
      </label>
      <div className="chon-chip__xoa">
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
