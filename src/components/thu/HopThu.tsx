"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { actionMoThu, type ThuDaMo } from "@/app/actions/thu";
import { phanThang, tenThang } from "@/lib/tam-trang/lich";
import { giamChuyenDong, PHONG_SVG } from "./chim";
import { SU_KIEN_THU_DA_MO } from "./ChoThu";
import { VietThu } from "./VietThu";

const MAT_MANG = "Chưa mở được thư, thử lại nhé.";

/**
 * Cua so doc thu (spec 5b F4, F6): hop thoai modal de len moi thu, ke ca khung YouTube (chu du an cho phep, nhac van phat).
 * Mo la hieu ung phong bi bay vao giua, nap mo, to thu troi len; cung luc goi actionMoThu (ghi da mo, lay noi dung). Noi
 * dung: "Gửi {tên mình},", thu, chu ky, gio gui; minh chua gui thu thang do thi ben duoi co to giay tra loi (gui xong co
 * chim dua thu, roi cua so dong). Giam chuyen dong: khong phong bi bay, thu hien thang.
 */
export function HopThu({ thang, tenKia, tenMinh, dong }: { thang: string; tenKia: string; tenMinh: string; dong: () => void }) {
  const router = useRouter();
  const hopRef = useRef<HTMLDialogElement>(null);
  const phongRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLElement>(null);
  const [thu, setThu] = useState<ThuDaMo | null>(null);
  const [loi, setLoi] = useState<string | null>(null);
  const t = phanThang(thang);
  const tenThangChu = t === null ? "tháng" : tenThang(t);

  useEffect(() => {
    const hop = hopRef.current;
    if (!hop) return;
    if (!hop.open) hop.showModal();
    // Bam ra nen mo (chinh the dialog, ngoai to thu) la dong, nhu Esc; nut Dong van co cho ban phim.
    const bamNen = (e: MouseEvent) => {
      if (e.target === hop) hop.close();
    };
    hop.addEventListener("click", bamNen);
    let huy = false;
    void actionMoThu(thang).then((r) => {
      if (huy) return;
      if ("error" in r) {
        setLoi(r.error);
        return;
      }
      setThu(r.thu);
      globalThis.dispatchEvent(new CustomEvent(SU_KIEN_THU_DA_MO, { detail: thang }));
    }, () => {
      if (!huy) setLoi(MAT_MANG);
    });
    const phong = phongRef.current;
    if (phong && typeof phong.animate === "function" && !giamChuyenDong()) {
      phong.animate([{ opacity: 0, transform: "translateY(-60px) rotate(-8deg) scale(.7)" }, { opacity: 1, transform: "rotate(0) scale(1)" }], {
        duration: 520, easing: "cubic-bezier(0.16, 1, 0.3, 1)",
      });
      phong.querySelector(".phong__nap")?.animate([{ transform: "none" }, { transform: "scaleY(-1)" }], {
        duration: 300, delay: 480, fill: "forwards", easing: "ease-in-out",
      });
      phong.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, delay: 820, fill: "forwards" });
    } else if (phong) {
      phong.hidden = true;
    }
    return () => {
      huy = true;
      hop.removeEventListener("click", bamNen);
    };
  }, [thang]);

  // To thu troi len tu phong bi khi noi dung vua toi (sau phong bi mo nap).
  useEffect(() => {
    const to = toRef.current;
    if (!thu || !to || typeof to.animate !== "function" || giamChuyenDong()) return;
    to.animate([
      { opacity: 0, transform: "translateY(90px) scale(.55)", clipPath: "inset(0 0 70% 0)" },
      { opacity: 1, transform: "translateY(0) scale(1)", clipPath: "inset(0 0 0 0)" },
    ], { duration: 620, delay: 720, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" });
  }, [thu]);

  const dongHop = () => {
    hopRef.current?.close();
  };

  return (
    <dialog ref={hopRef} className="thu-hop" aria-label={`Thư ${tenThangChu} của ${tenKia}`} onClose={dong}>
      <div className="thu-hop__san">
        <div className="thu-hop__phong" ref={phongRef} aria-hidden="true" dangerouslySetInnerHTML={{ __html: PHONG_SVG }} />
        <article className="thu-hop__to" ref={toRef} aria-busy={thu === null && loi === null ? true : undefined}>
          {thu === null ? (
            <p className="thu-hop__cho">{loi ?? "Đang mở thư"}</p>
          ) : (
            <>
              <p className="thu-la__gui">{`Gửi ${tenMinh},`}</p>
              <p className="thu-la__than">{thu.noiDung}</p>
              <p className="thu-la__ky">{tenKia}</p>
              <p className="thu-la__gio">{`Thư ${tenThangChu}, ${tenKia} gửi ${thu.gio}`}</p>
              {!thu.minhGui && (
                <div className="thu-hop__tl">
                  <p className="thu-hop__tl-t">{`Viết thư trả lời ${tenKia}`}</p>
                  <VietThu
                    thang={thang}
                    tenKia={tenKia}
                    tenThangChu={tenThangChu}
                    daGui={() => {
                      dongHop();
                      router.refresh();
                    }}
                  />
                </div>
              )}
            </>
          )}
          <div className="thu-hop__dong">
            <button type="button" className="btn btn--line" onClick={dongHop}>{thu !== null && !thu.minhGui ? "Để sau" : "Đóng"}</button>
          </div>
        </article>
      </div>
    </dialog>
  );
}
