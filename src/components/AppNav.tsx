import Link from "next/link";
import { db } from "@/server/db";
import { camXucChoToi } from "@/server/cam-xuc/cam-xuc";
import { thuChuaMo } from "@/server/thu/thu";
import type { Me } from "@/server/web/guard";
import { LinhVat } from "./linh-vat/LinhVat";
import { LaThuBay } from "./thu/LaThuBay";
import { Logo } from "./Logo";
import { LINKS, type NavSection } from "./nav-links";

export type { NavSection };

/**
 * Thanh dieu huong chinh. Khong co nen vien thuoc: muc dang o la chu dam mau muc kem gach duoi 2px sat mep
 * duoi thanh. Nguoi dang vao hien bang chu, khong co o tron. current la muc dang o. subpage = true khi dang o man con cua muc do
 * (tao, sua, doc sach): lien ket mang aria-current="true" thay vi "page".
 * sticky = false cho man co thanh dinh rieng ben duoi (man viet), de hai thanh khong chong nhau, va cho man doc
 * sach co nhac, de nav khong bao gio de len trinh phat YouTube.
 * Kem la thu troi (5b): thu nguoi kia gui ma nguoi dang vao chua mo, doc san o may chu de doi trang khong chop. Kem Chip va
 * Kho cam xuc (5d): hang cam xuc nguoi kia tha ma nguoi dang vao chua thay, cung doc san o may chu. linhVat = false cho
 * man lam viec phu kin man hinh (doc sach, viet, sua luot): goc duoi ben trai o do la chu dang doc hay nut Dang, Chip
 * ngoi len se che; cam xuc toi luc ay cho o hang, dien khi sang trang khac.
 */
export async function AppNav({ me, current, subpage = false, sticky = true, linhVat = true }: {
  me: Me;
  current: NavSection | null;
  subpage?: boolean;
  sticky?: boolean;
  linhVat?: boolean;
}) {
  const [thu, hangCamXuc] = await Promise.all([thuChuaMo(db, me.accountId), linhVat ? camXucChoToi(db, me.accountId) : []]);
  return (
    <>
      <nav className={sticky ? "nav" : "nav nav--tinh"} aria-label="Điều hướng chính">
        <div className="nav__in shell">
          <Link className="wordmark d" href="/ke-sach">
            <Logo className="wordmark__logo" />Món Quà Của Em
          </Link>
          <div className="nav__links">
            {LINKS.map((l) => (
              <Link
                key={l.key}
                className="nav__link"
                href={l.href}
                aria-current={l.key === current ? (subpage ? "true" : "page") : undefined}
              >
                {l.label}
              </Link>
            ))}
          </div>
          <div className="nav__right">
            <span className="who">Đang vào: <b>{me.nickname}</b></span>
            {/* /viet chuyen huong luc bam, nen tai truoc khong co gi de dung lai. Nut cap chu: hanh dong chinh cua
                moi man nam trong man, khong nam tren thanh dieu huong. */}
            <Link className="btn btn--chu" href="/viet" prefetch={false}>Trang mới</Link>
          </div>
        </div>
      </nav>
      <LaThuBay tenKia={me.partnerNickname} tenMinh={me.nickname} dau={thu} />
      {linhVat && <LinhVat tenKia={me.partnerNickname} tenMinh={me.nickname} hangDau={hangCamXuc} />}
    </>
  );
}
