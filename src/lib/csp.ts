/**
 * Chuoi Content-Security-Policy cua ca web. Ham thuan: khong import `next`, khong doc
 * bien moi truong, chi nhan nonce cua request va co danh dau moi truong phat trien, nen kiem duoc ma
 * khong can dung may chu.
 *
 * Moi chi thi kem ly do nguon do co mat. Danh sach nay se bi nguoi sau doc va hoi "cai nay de lam gi",
 * nen cau tra loi phai nam ngay canh no. Bo bot mot nguon la lam hong mot tinh nang, khong phai siet them.
 */
export function chuoiCsp(nonce: string, dev: boolean): string {
  const chiThi = [
    // Mac dinh chi tin chinh may chu nay; moi nguon ngoai phai duoc goi ten o mot chi thi rieng ben duoi.
    "default-src 'self'",

    // Nonce cho cac the script Next sinh ra. 'strict-dynamic' de mot script da duoc tin tu chen duoc
    // script con: day dung la cach src/components/music/youtubeApi.ts nap YouTube IFrame API bang
    // document.createElement("script"), nen khong phai mo ca mien www.youtube.com trong danh sach nay.
    // React dung eval de dung lai ngan xep loi cua may chu khi phat trien (tai lieu Next ghi ro), nen
    // 'unsafe-eval' chi co o do va khong bao gio co o ban phat hanh.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,

    // Ban phat hanh: the <style> noi tuyen do Next sinh ra duoc nonce cuu; tep .css da dung goi van la 'self'.
    // Luc phat trien: 'unsafe-inline' va KHONG nonce, theo muc "Development Environment" cua
    // node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md. Cong cu dev (style-loader cua
    // CSS nap nong, lop phu bao loi) chen the <style> khong mang nonce; va khi chi thi da co nonce thi trinh
    // duyet bo qua 'unsafe-inline', nen phai bo nonce chu khong phai them 'unsafe-inline' canh no. The <style>
    // cua TipTap van gan nonce (src/components/editor/nonce.ts): duoi 'unsafe-inline' thuoc tinh do vo hai.
    `style-src 'self' ${dev ? "'unsafe-inline'" : `'nonce-${nonce}'`}`,
    // Nonce khong cuu duoc THUOC TINH style, chi cuu duoc the <style>. Bay cho `style={` con lai tinh gia
    // tri luc chay (he so thu phong to giay, goc xoay cua to dang lat, do dai tung vach nhoe) va bo chung
    // di la mat cac hieu ung do, nen mo rieng cho thuoc tinh style.
    "style-src-attr 'unsafe-inline'",

    // data: cho bia du phong ve bang SVG noi tuyen; blob: cho anh xem thu truoc khi tai len.
    "img-src 'self' data: blob:",
    // Ghi am da luu phat tu /m/[id] (self), con ban nghe thu TRUOC KHI chen phat tu mot blob: URL.
    "media-src 'self' blob:",
    // next/font/google tai phong ve luc dung va tu phuc vu, nen khong mo fonts.googleapis.com hay
    // fonts.gstatic.com. Neu mot ngay nao do phong duoc nap tu mang that thi moi phai them vao day.
    "font-src 'self'",
    // Server action va moi fetch cua trang chi goi chinh may chu nay.
    "connect-src 'self'",
    // Trinh phat nhac nen nhung qua ban khong luu dau chan cua YouTube.
    "frame-src https://www.youtube-nocookie.com",

    // Khong nhung <object>/<embed> o dau ca.
    "object-src 'none'",
    // Khong cho ke tan cong doi goc cua duong dan tuong doi bang mot the <base>.
    "base-uri 'self'",
    // Form chi duoc gui ve chinh may chu nay.
    "form-action 'self'",
    // Khong ai duoc nhung web nay vao khung cua ho (chong clickjacking).
    "frame-ancestors 'none'",
    // Xin tai nguyen http:// thi nang len https:// (trinh duyet bo qua dieu nay voi localhost).
    "upgrade-insecure-requests",
  ];
  return chiThi.join("; ");
}

/** Chi phan cua tai lieu ma `nonceCuaTaiLieu` cham toi, de kiem duoc ham nay ma khong can DOM that. */
export type NoiCoNonce = { querySelector(chon: string): { nonce?: string } | null };

/**
 * Nonce cua CHINH tai lieu dang mo, doc tu mot the script ma Next da gan nonce.
 *
 * Vi sao khong lay nonce tu may chu truyen xuong qua prop: chuyen trang ben trong ung dung khong tai lai
 * tai lieu, nen CSP dang thuc thi van la CSP cua lan tai dau tien, trong khi moi lan lay du lieu RSC lai
 * sinh mot nonce khac. Nonce dung duy nhat la nonce dang nam trong chinh tai lieu nay.
 *
 * Trinh duyet giau GIA TRI thuoc tinh nonce khoi HTML (chong ro ri qua bo chon CSS) nhung van tra lai no
 * qua thuoc tinh IDL `.nonce` cho script cung nguon, nen phai doc bang `.nonce` chu khong phai
 * `getAttribute("nonce")`. Khong tim thay thi tra undefined: trang khong co CSP thi cung khong can nonce.
 */
export function nonceCuaTaiLieu(taiLieu: NoiCoNonce): string | undefined {
  const nonce = taiLieu.querySelector("script[nonce]")?.nonce;
  return nonce !== undefined && nonce !== "" ? nonce : undefined;
}
