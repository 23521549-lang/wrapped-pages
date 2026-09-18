import { NextResponse, type NextRequest } from "next/server";
import { chuoiCsp } from "@/lib/csp";

/**
 * Next 16 khai tu `middleware` va doi ten thanh `proxy`. Tep PHAI ten la proxy.ts va nam ngang hang voi
 * `app` (o day la src/proxy.ts). Dat nham ten middleware.ts thi tep khong bao gio chay, CSP khong bao gio
 * duoc dat, va khong co loi nao bao ca: tests/e2e/csp.spec.ts doc header tren mot response that de bat
 * dung kieu hong im lang do.
 *
 * Moi request mot nonce moi: nonce dat vao header REQUEST x-nonce va Content-Security-Policy de Next doc
 * ra luc dung trang (Next tu gan nonce cho the script cua no), va dat vao header RESPONSE cung ten de
 * trinh duyet thuc thi. Xem node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md.
 */
export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = chuoiCsp(nonce, process.env.NODE_ENV === "development");

  const headerRequest = new Headers(request.headers);
  headerRequest.set("x-nonce", nonce);
  headerRequest.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: headerRequest } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Chay cho moi duong dan, tru:
     * - _next/static, _next/image: tep tinh va anh da toi uu, khong phai tai lieu nen khong can CSP.
     * - favicon.ico: tep don le, cung vay.
     * Va tru request prefetch cua next/link (theo khuyen nghi cua tai lieu Next): prefetch tra ve du lieu
     * RSC chu khong phai tai lieu HTML, sinh nonce cho no la phi cong.
     */
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
