import { nonceCuaTaiLieu } from "@/lib/csp";

/**
 * Nonce cua tai lieu dang mo, doc mot lan khi goi ma nay nap o trinh duyet. Tren may chu khong co
 * `document` nen la undefined, va cung khong can: the <style> ma TipTap chen chi sinh ra o trinh duyet.
 *
 * Doc tu tai lieu chu khong nhan tu may chu qua prop: chuyen trang ben trong ung dung khong tai lai tai
 * lieu, nen CSP dang thuc thi van la CSP cua lan tai dau tien, trong khi moi lan lay du lieu RSC lai co
 * mot nonce khac. Xem them chu thich cua nonceCuaTaiLieu o src/lib/csp.ts.
 */
export const NONCE_TAI_LIEU = typeof document === "undefined" ? undefined : nonceCuaTaiLieu(document);
