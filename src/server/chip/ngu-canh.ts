import type { AnyDb } from "@/server/db/types";
import { listActivity } from "@/server/feed/list";
import { listShelf } from "@/server/library/shelf";
import { currentMoods } from "@/server/mood/moods";
import { thuCacThang } from "@/server/thu/thu";
import { feedLine } from "@/lib/feed/line";
import { phanThang, tenThang } from "@/lib/tam-trang/lich";
import { TROI } from "@/lib/tam-trang/troi";
import { dayLabel, timeLabel } from "@/lib/when";

/*
 * Ngu canh gui AI cho Chip (5e, spec D3): CHI nhung gi nguoi hoi von thay tren web, dung tu dung cac ham doc dang co (da
 * loc theo luat xem, niem phong, rieng tu). Khong bao gio doc: noi dung niem phong chua mo, ban nhap, sach rieng tu cua
 * nguoi kia, loi nhan bi mat luc tao tai khoan, mat khau, tro chuyen cua nguoi kia voi Chip, noi dung thu thang. Khong mang
 * id noi bo nao. Moi phan co tran do dai de ca luot goi nam gon trong han muc token.
 */

/** Bo ky tu dieu khien (xuong dong, tab...) khoi chu trinh duyet gui, de chung khong chen dong gia vao ngu canh. */
const boDieuKhien = (s: string) => [...s].map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? " " : c)).join("");

/** Viec gan day trong phien cua nguoi hoi (trinh duyet gui, chua tin): toi da 10 muc, moi muc 80 ky tu. */
export function lamSachViec(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x): x is string => typeof x === "string")
    .map((x) => [...boDieuKhien(x).trim()].slice(0, 80).join(""))
    .filter((x) => x.length > 0)
    .slice(-10);
}

/** Ten trang dang mo (trinh duyet gui, chua tin): 60 ky tu, bo ky tu dieu khien. */
export function lamSachTrang(raw: unknown): string {
  return typeof raw === "string" ? [...boDieuKhien(raw).trim()].slice(0, 60).join("") : "";
}

const cat = (s: string, n: number) => {
  const k = [...s.replace(/\s+/g, " ").trim()];
  return k.length > n ? `${k.slice(0, n).join("")}...` : k.join("");
};

/**
 * Dung chuoi ngu canh cho mot lan hoi cua viewerId. tenMinh, tenKia la biet danh hien tai; trang va viec la nhung gi
 * trinh duyet ke (da lam sach). Doc tren nhieu ham rieng; moi ham tu loc theo nguoi xem.
 */
export async function dungNguCanh(
  db: AnyDb,
  viewerId: string,
  tenMinh: string,
  tenKia: string,
  trang: string,
  viec: string[],
  now: Date,
): Promise<string> {
  const [tamTrang, hoatDong, ke, thu] = await Promise.all([
    currentMoods(db, now),
    listActivity(db, viewerId, now),
    listShelf(db, viewerId, now),
    thuCacThang(db, viewerId),
  ]);
  const dong: string[] = [];
  dong.push(`Bây giờ: ${dayLabel(now, now)}, ${timeLabel(now)} (giờ Việt Nam).`);
  if (trang !== "") dong.push(`${tenMinh} đang mở trang: ${trang}.`);
  if (viec.length > 0) dong.push(`Vừa làm trên web: ${viec.join("; ")}.`);

  const tt = tamTrang.map((m) => {
    const ai = m.accountId === viewerId ? tenMinh : tenKia;
    return `${ai}: ${TROI[m.weather].ten}${m.note === null ? "" : `, nhắn "${cat(m.note, 120)}"`} (thả lúc ${timeLabel(m.setAt)})`;
  });
  dong.push(tt.length > 0 ? `Tâm trạng đang giữ: ${tt.join("; ")}.` : "Chưa ai đang giữ tâm trạng nào.");

  const names = { partner: tenKia };
  const hd = hoatDong.slice(0, 20).map((item) => {
    const cau = feedLine(item, names).sentence.map((d) => d.chu).join("");
    const ai = item.by === "me" ? cau.replace(/^Bạn/, tenMinh) : cau;
    return `- ${dayLabel(item.at, now)} ${timeLabel(item.at)}: ${ai}${item.isNew ? " (chưa xem)" : ""}`;
  });
  dong.push(hd.length > 0 ? `Hoạt động gần đây:\n${hd.join("\n")}` : "Chưa có hoạt động nào.");

  const sach = ke.slice(0, 30).map((b) => {
    const cua = b.vietCung ? `${b.ownerNickname} và ${b.mine ? tenKia : tenMinh} cùng viết` : b.mine ? `của ${tenMinh}` : `của ${tenKia}`;
    const moi = b.newCount > 0 ? `, ${b.newCount} trang mới ${tenMinh} chưa đọc` : "";
    const khoa = b.lockedCount > 0 ? `, ${b.lockedCount} trang còn khóa` : "";
    const trich = b.excerpt === null || b.excerptLocked ? "" : `, đoạn trích: "${cat(b.excerpt, 140)}"`;
    return `- "${b.title}" (${cua}, ${b.pageCount} trang${moi}${khoa}${b.mode === "rieng-tu" ? ", riêng tư" : ""}${trich})`;
  });
  dong.push(sach.length > 0 ? `Kệ sách ${tenMinh} thấy:\n${sach.join("\n")}` : "Kệ sách chưa có cuốn nào.");

  const th = thu.slice(0, 6).map((t) => {
    const k = phanThang(t.thang);
    const ten = k === null ? t.thang : tenThang(k);
    return `${ten}: ${tenMinh} ${t.minhGui ? "đã gửi" : "chưa gửi"}, ${tenKia} ${t.kiaGui ? "đã gửi" : "chưa gửi"}`;
  });
  if (th.length > 0) dong.push(`Thư tháng (chỉ trạng thái): ${th.join("; ")}.`);
  return dong.join("\n");
}
