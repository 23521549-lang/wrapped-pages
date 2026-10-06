"use client";

import { useState, useTransition } from "react";
import { actionAnHoatDong } from "@/app/actions/feed";

/**
 * Muc "Hoat dong" o Cai dat (06/10): an hoat dong cua minh khoi khung Hoat dong cua CA HAI nguoi, tu luc bat tro di.
 * O danh dau doi ngay khi bam (khong cho trang lam moi); may chu luu trong nen, va action goi refresh() nen Ke sach ve
 * lai voi khung da loc.
 *
 * Luu that bai thi HOAN NGUYEN o danh dau va noi ra loi, khac voi muc "Chíp" ngay tren (action cua no tra void nen no
 * bo qua ket qua). Day la cong tac rieng tu: de nguoi dung tuong minh da an trong khi chua an duoc la cai gia dat nhat
 * ma man nay co the tra, nen mot lan luu that bai phai thay duoc ngay chu khong doi tai lai trang moi hien ra.
 *
 * Cau chu co y KHONG hua "khong luu gi ve ban": may chu van ghi dong vao bang activity, chi khong hien no. Noi that cho
 * nay quan trong hon nghe gon, va chinh viec van ghi la ly do So nhac thang khong mat bai nao.
 */
export function CaiDatHoatDong({ an, tenKia }: { an: boolean; tenKia: string }) {
  const [pending, batDau] = useTransition();
  const [daAn, setDaAn] = useState(an);
  const [loi, setLoi] = useState<string | null>(null);
  return (
    <section className="muc" aria-labelledby="cai-dat-hoat-dong">
      <h2 className="d muc__t" id="cai-dat-hoat-dong">Hoạt động</h2>
      <p className="muc__x">
        Bật thì từ giờ việc bạn làm không hiện ở khung Hoạt động nữa, với cả bạn và {tenKia}. Những dòng đã có vẫn còn.
        {" "}
        {tenKia} vẫn đọc được trang mới của bạn, vẫn nhận được cảm xúc, thư và tâm trạng bạn gửi, chỉ là không thấy dòng
        nào báo.
      </p>
      <label className="o-chon">
        <input
          type="checkbox"
          checked={daAn}
          disabled={pending}
          onChange={(e) => {
            const bat = e.target.checked;
            setDaAn(bat);
            setLoi(null);
            batDau(async () => {
              const r = await actionAnHoatDong(bat);
              if ("error" in r) {
                setDaAn(!bat);
                setLoi(r.error);
              }
            });
          }}
        />
        Ẩn hoạt động của tôi
      </label>
      {loi === null ? null : <output className="muc__x">{loi}</output>}
    </section>
  );
}
