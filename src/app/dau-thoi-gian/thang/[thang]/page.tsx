import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { tenCacBai } from "@/server/media/ten-youtube";
import { baiCuaThang, thangCoNhac, type BaiSo } from "@/server/nhac/so-nhac";
import { requireMe } from "@/server/web/guard";
import { AppNav } from "@/components/AppNav";
import { MuiTen } from "@/components/glyph";
import { SoNhac, type BaiSoHien } from "@/components/so-nhac/SoNhac";
import { phanThang, tenThang, thangKhoa } from "@/lib/tam-trang/lich";
import { thangDaKhep } from "@/lib/thu";

const THAY_TEN_BAI = "Bản nhạc trên YouTube";

/**
 * So nhac mot thang (dot nam 5b, spec B3): moi bai hai nguoi dat cho sach cua minh trong thang, moi nguoi mot danh sach
 * phat (nguoi kia truoc). Thang sai dang hay chua khep thi 404. Nguoi xem chi thay bai o cuon minh doc duoc (baiCuaThang).
 * Ten bai va kenh lay tu YouTube o may chu (tenCacBai); lay khong duoc thi cau thay.
 */
export default async function SoNhacThang({ params }: { params: Promise<{ thang: string }> }) {
  await connection();
  const [me, { thang: khoa }] = await Promise.all([requireMe(), params]);
  const now = new Date();
  const t = phanThang(khoa);
  if (t === null || !thangDaKhep(t, now)) notFound();
  const [bai, cacSo] = await Promise.all([baiCuaThang(db, me.accountId, t), thangCoNhac(db, me.accountId, now)]);
  const ten = await tenCacBai([...bai.kia, ...bai.minh, ...bai.chung].map((b) => b.youtubeId));
  // Danh sach chung (5c muc J1) ghi them ai dat bai; hai danh sach rieng thi khong can.
  const hien = (ds: BaiSo[], ghiAi = false): BaiSoHien[] => ds.map((b) => ({
    key: `${b.youtubeId}-${b.at.getTime()}`,
    youtubeId: b.youtubeId,
    ten: ten[b.youtubeId]?.ten ?? THAY_TEN_BAI,
    kenh: ten[b.youtubeId]?.kenh ?? null,
    nguon: `${b.bookTitle}, ${b.ordinal === null ? "lúc tạo sách" : `lượt ${b.ordinal}`}${b.rieng ? ", riêng tư" : ""}`
      + (ghiAi ? `, ${b.ai === "minh" ? me.nickname : me.partnerNickname} đặt` : ""),
  }));

  const k = thangKhoa(t);
  const truoc = cacSo.find((s) => s.thang < k)?.thang ?? null;
  // cacSo moi nhat truoc: thang truoc la thang dau tien nho hon, thang sau la thang lon hon gan nhat.
  const sau = cacSo.reduce<string | null>((gan, s) => (s.thang > k && (gan === null || s.thang < gan) ? s.thang : gan), null);
  const tenCua = (x: string) => tenThang(phanThang(x) ?? t);
  return (
    <>
      {/* Khung phat nhac nam trong trang: nav khong dinh, de khong gi (ke ca nav) de len trinh phat YouTube. */}
      <AppNav me={me} current="dau-thoi-gian" subpage sticky={false} />
      <main className="shell man">
        <div className="head">
          <div>
            <Link className="ve-lai" href="/dau-thoi-gian"><MuiTen huong="trai" />Dấu thời gian</Link>
            <h1 className="d">{`Sổ nhạc ${tenThang(t)}`}</h1>
            <p className="head__sub">Bấm tam giác để nghe. Hết một danh sách thì phát tiếp danh sách sau.</p>
          </div>
          <div className="sn-thang">
            {truoc === null ? (
              <button type="button" className="btn btn--quiet btn--icon" aria-label="Sổ tháng trước" disabled><MuiTen huong="trai" /></button>
            ) : (
              <Link className="btn btn--quiet btn--icon" href={`/dau-thoi-gian/thang/${truoc}`} aria-label={`Sổ nhạc ${tenCua(truoc)}`}><MuiTen huong="trai" /></Link>
            )}
            {sau === null ? (
              <button type="button" className="btn btn--quiet btn--icon" aria-label="Sổ tháng sau" disabled><MuiTen huong="phai" /></button>
            ) : (
              <Link className="btn btn--quiet btn--icon" href={`/dau-thoi-gian/thang/${sau}`} aria-label={`Sổ nhạc ${tenCua(sau)}`}><MuiTen huong="phai" /></Link>
            )}
          </div>
        </div>
        <SoNhac
          key={k}
          thang={k}
          href={`/dau-thoi-gian/thang/${k}`}
          ds={[
            { khoa: "kia", ten: `Của ${me.partnerNickname}`, bai: hien(bai.kia) },
            { khoa: "minh", ten: `Của ${me.nickname}`, bai: hien(bai.minh) },
            // Danh sach "Hai Ngòi Bút" chi hien khi co bai (5c muc J1).
            ...(bai.chung.length > 0 ? [{ khoa: "chung", ten: "Hai Ngòi Bút", chung: true, bai: hien(bai.chung, true) }] : []),
          ]}
        />
      </main>
    </>
  );
}
