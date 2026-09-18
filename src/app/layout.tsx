import type { Metadata } from "next";
import "@/styles/globals.css";
import { InkDefs } from "@/components/book/CoverArt";
import { lopPhong } from "./phong";

export const metadata: Metadata = { title: "Món Quà Của Em" };

/**
 * Nonce cua CSP chi sinh duoc khi co request (src/proxy.ts), nen moi trang phai dung dong. Trang tinh dung
 * san luc build khong co nonce nao tren the script cua no, va 'strict-dynamic' chan sach nhung the do: da
 * do tan mat tren /cho va /dang-nhap truoc khi them dong nay. Tai lieu Next noi thang "when you use nonces
 * in your CSP, all pages must be dynamically rendered"
 * (node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md, muc Forcing dynamic rendering).
 * /cho van khong cham database nen van tra 200 - no la moc "san sang" cua webServer trong playwright.config.ts.
 */
export const dynamic = "force-dynamic";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={lopPhong}>
      <body>
        {/* Bo loc muc cua moi bia khai mot lan o day; CoverArt chi tro toi no bang id. */}
        <InkDefs />
        {children}
      </body>
    </html>
  );
}
