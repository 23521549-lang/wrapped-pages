import { Logo } from "./Logo";
import { LINKS, type NavSection } from "./nav-links";

/*
 * Khung giu cho cua cac loading.tsx. Next tai truoc ranh gioi loading khi tai truoc lien ket, nen bam la thay khung
 * nay ngay, roi trang that thay vao khi may chu tra xong.
 *
 * Chi co hinh tinh: khong mot du lieu nao cua ai, nen khong the lo ban nhap, sach rieng tu hay trang niem phong.
 * Khong co the main hay tieu de: trang that mang chung, nen khong gi cua khung bi nham la trang da xong.
 * Moi hinh an voi trinh doc man hinh; chi co mot dong trang thai "Dang mo ...".
 *
 * Khong nhap thanh phan client nao (ke ca next/link): Next chen the script cho thanh phan client cua loading.tsx ma
 * khong gan nonce, va CSP chan the do. Vi vay thanh dieu huong o day la ban ve cung hinh, khong co lien ket.
 */

/** Khoa co dinh cho cac hang giu cho: danh sach khong bao gio doi thu tu nen khoa theo chu cai la du. */
const KHOA = ["a", "b", "c", "d", "e", "f", "g"];

/** Mot vach giu cho. Chi la hinh; kieu nam o khung-cho.css. */
function V({ c }: { c: string }) {
  return <span className={`vach-cho ${c}`} />;
}

/** Nhieu vach dong chu, dong cuoi ngan hon. */
function Dong({ n, c = "" }: { n: number; c?: string }) {
  return (
    <span className={`dong-cho ${c}`}>
      {KHOA.slice(0, n).map((k, i) => <V key={k} c={i === n - 1 ? "vach-cho--cuoi" : "vach-cho--dong"} />)}
    </span>
  );
}

/** Thanh dieu huong cung hinh voi AppNav trong luc cho: chi de trang khong nhay khi AppNav that thay vao. */
function NavCho({ current, sticky }: { current: NavSection | null; sticky: boolean }) {
  return (
    <div className={sticky ? "nav" : "nav nav--tinh"} aria-hidden="true">
      <div className="nav__in shell">
        <span className="wordmark d"><Logo className="wordmark__logo" />Món Quà Của Em</span>
        <span className="nav__links">
          {LINKS.map((l) => (
            <span key={l.key} className="nav__link" aria-current={l.key === current ? "page" : undefined}>{l.label}</span>
          ))}
        </span>
        <span className="nav__right"><span className="btn btn--chu">Trang mới</span></span>
      </div>
    </div>
  );
}

function Khung({ ten, current, sticky = true, lop = "shell man", children }: {
  ten: string;
  current: NavSection | null;
  sticky?: boolean;
  lop?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <NavCho current={current} sticky={sticky} />
      <div className={`khung-cho ${lop}`} aria-busy="true">
        <output className="sr-only">Đang mở {ten}…</output>
        <div className="khung-cho__hinh" aria-hidden="true">{children}</div>
      </div>
    </>
  );
}

/** Dau man chung (.head / .ke-dau): tieu de, dong phu, co the kem nhom nut. */
function Dau({ lop = "head", nut = false }: { lop?: string; nut?: boolean }) {
  return (
    <div className={lop}>
      <div className="khung-cho__dau">
        <V c="vach-cho--tieu-de" />
        <V c="vach-cho--phu" />
      </div>
      {/*
        Dong tieu de ke sach co HAI nut: "Tha tam trang" (rong hon vi co cham mau) roi "Sach moi". Giu cho thieu mot
        nut thi bo cuc nhay mot nhip dung luc trang that thay vao - dung cai ma khung giu cho sinh ra de tranh.
      */}
      {nut && (
        <div className="ke-dau__nut">
          <V c="vach-cho--nut vach-cho--nut-troi" />
          <V c="vach-cho--nut" />
        </div>
      )}
    </div>
  );
}

export function KhungKeSach() {
  return (
    <Khung ten="kệ sách" current="ke-sach">
      <Dau lop="ke-dau" nut />
      <div className="dau-ke">
        <span className="sach-mo-cho" />
        <span className="hoat-dong-cho"><Dong n={6} /></span>
      </div>
      <div className="ngan">
        <div className="ngan__dau"><V c="vach-cho--ngan" /></div>
        <ul className="hang">
          {KHOA.slice(0, 4).map((k) => (
            <li key={k} className="cuon-cho">
              <span className="bia-cho" />
              <span className="ke-mep" />
              <Dong n={2} />
            </li>
          ))}
        </ul>
      </div>
    </Khung>
  );
}

/** Mot danh sach sach co bia nho o dau dong: trang Ban nhap, va trang chon cuon cua Dau thoi gian. */
export function KhungDanhSach({ ten, current }: { ten: string; current: NavSection }) {
  return (
    <Khung ten={ten} current={current}>
      <Dau />
      <ul className="nhap-ds">
        {KHOA.slice(0, 3).map((k) => (
          <li key={k} className="nhap nhap-cho">
            <span className="nhap__bia bia-cho" />
            <Dong n={3} c="nhap-cho__chu" />
          </li>
        ))}
      </ul>
    </Khung>
  );
}

function Muc({ n }: { n: number }) {
  return (
    <div className="muc">
      <V c="vach-cho--ngan" />
      <Dong n={n} />
    </div>
  );
}

export function KhungCaiDat() {
  return (
    <Khung ten="cài đặt" current="cai-dat">
      <Dau />
      <div className="cai-dat">
        <div className="cai-dat__cot"><Muc n={2} /><Muc n={3} /><V c="vach-cho--o" /><V c="vach-cho--nut" /></div>
        <div className="cai-dat__cot"><Muc n={2} /><Muc n={2} /></div>
      </div>
    </Khung>
  );
}

/** Form sua sach: cac o ben trai, o xem truoc bia ben phai. */
export function KhungFormSach({ ten = "sách", oTen = true }: { ten?: string; oTen?: boolean } = {}) {
  const o = (
    <div className="field">
      <V c="vach-cho--nhan" />
      <V c="vach-cho--o" />
    </div>
  );
  // Trang Viet tiep khong co o ten sach va khong co muc Ai doc duoc: khung giu cho phai ve dung chung ay khoi, khong
  // thi bo cuc nhay mot nhip dung luc trang that thay vao - dung cai ma khung giu cho sinh ra de tranh.
  return (
    <Khung ten={ten} current="ke-sach">
      <Dau />
      <div className="tao">
        <div className="form">
          {oTen && o}
          {oTen && (
            <div className="field">
              <V c="vach-cho--nhan" />
              <V c="vach-cho--the" />
              <V c="vach-cho--the" />
            </div>
          )}
          <div className="picker">{KHOA.slice(0, 4).map((k) => <span key={k} className="bia-cho" />)}</div>
          {o}
        </div>
        <div className="xem-truoc"><span className="bia-cho" /></div>
      </div>
    </Khung>
  );
}

/** Man doc: dau man va cuon sach mo (hai to tren man rong, mot to tren man hep). */
export function KhungDoc() {
  return (
    <Khung ten="sách" current="ke-sach">
      <div className="doc-head">
        <div className="doc-head__chu khung-cho__dau">
          <V c="vach-cho--tieu-de" />
          <V c="vach-cho--phu" />
        </div>
      </div>
      <div className="sach-cho">
        <span className="giay-cho"><Dong n={7} /></span>
        <span className="giay-cho giay-cho--phai"><Dong n={5} /></span>
      </div>
    </Khung>
  );
}

/** Man viet va man sua luot: thanh tren (ten, cong cu) va mot to giay. */
export function KhungViet({ ten }: { ten: string }) {
  return (
    <Khung ten={ten} current="ke-sach" sticky={false} lop="viet">
      <div className="viet-tren">
        <div className="viet-dau"><V c="vach-cho--ten" /><V c="vach-cho--nut" /></div>
        <div className="cong-cu-cho">{KHOA.map((k) => <V key={k} c="vach-cho--cong-cu" />)}</div>
      </div>
      <div className="viet-mat">
        <span className="giay-cho giay-cho--don"><Dong n={6} /></span>
      </div>
    </Khung>
  );
}

/** Lich hoa: dau man, dong thang, luoi tuan, khung chi tiet. Nhu trang that, khong muc nao cua thanh dieu huong duoc danh dau. */
/** Mot trang lich: dong dau co hai mui ten, luoi ben trai, khung chi tiet ben phai. Lich hoa va Dau thoi gian. */
export function KhungLich({ ten, current }: { ten: string; current: NavSection | null }) {
  return (
    <Khung ten={ten} current={current}>
      <Dau />
      <div className="lich-trang">
        <div>
          <div className="thang"><V c="vach-cho--ngan" /></div>
          <Dong n={6} />
        </div>
        <div className="phu"><Dong n={3} /></div>
      </div>
    </Khung>
  );
}
