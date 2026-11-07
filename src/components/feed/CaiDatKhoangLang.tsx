"use client";

import { useState, useTransition } from "react";
import { actionKhoangLang } from "@/app/actions/feed";
import { CHUA_LUU_KHOANG_LANG } from "@/app/actions/messages";

/**
 * Muc "Khoang Lang" o Cai dat (11/06): bat thi giao dien cua RIENG nguoi bat chi hien noi dung cua chinh minh,
 * moi thong tin ve nguoi kia tam an. O danh dau doi ngay khi bam (khong cho trang lam moi); may chu luu trong nen,
 * va action goi refresh() nen moi trang ve lai voi noi dung da loc.
 *
 * Luu that bai thi HOAN NGUYEN o danh dau va noi ra loi, nhu muc "Hoat dong" ngay tren. Day la cong tac rieng tu:
 * de nguoi dung tuong minh da bat trong khi chua bat duoc la cai gia dat nhat ma man nay co the tra, nen mot lan
 * luu that bai phai thay duoc ngay chu khong doi tai lai trang moi hien ra.
 *
 * Cau chu co y KHONG hua "khong luu gi": du lieu van con nguyen, chi khong hien. Va khong hua "tro ve luc bat":
 * tat la hien lai day du NHU MOI NHAT, ke ca nhung gi xay ra trong luc bat. Ten nguoi kia khong xuat hien o day.
 */
export function CaiDatKhoangLang({ an }: { an: boolean }) {
  const [pending, batDau] = useTransition();
  const [daBat, setDaBat] = useState(an);
  const [loi, setLoi] = useState<string | null>(null);
  return (
    <section className="muc" aria-labelledby="cai-dat-khoang-lang">
      <h2 className="d muc__t" id="cai-dat-khoang-lang">Khoảng Lặng</h2>
      <p className="muc__x">
        Bật thì giao diện của bạn chỉ hiện nội dung của chính bạn. Mọi thứ khác tạm ẩn đi, nhưng dữ liệu vẫn còn
        nguyên, không mất gì; tắt là hiện lại đầy đủ như mới nhất. Trong lúc bật, bạn vẫn viết, gửi thư, thả cảm
        xúc như thường; chỉ phần hiển thị thay đổi.
      </p>
      <label className="o-chon">
        <input
          type="checkbox"
          checked={daBat}
          disabled={pending}
          onChange={(e) => {
            const bat = e.target.checked;
            setDaBat(bat);
            setLoi(null);
            batDau(async () => {
              try {
                const r = await actionKhoangLang(bat);
                if ("error" in r) {
                  setDaBat(!bat);
                  setLoi(r.error);
                }
              } catch {
                // Mat mang thi action nem loi thay vi tra {error}: cung hoan nguyen
                // va noi ra loi, khong de loi vang len error boundary lam sap trang.
                setDaBat(!bat);
                setLoi(CHUA_LUU_KHOANG_LANG);
              }
            });
          }}
        />
        Bật Khoảng Lặng
      </label>
      {loi === null ? null : <output className="muc__x">{loi}</output>}
    </section>
  );
}
