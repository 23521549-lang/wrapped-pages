import { Lexend, Be_Vietnam_Pro } from "next/font/google";

const lexend = Lexend({ subsets: ["vietnamese", "latin"], weight: ["400","500","600"], variable: "--f-display" });
const bvp = Be_Vietnam_Pro({ subsets: ["vietnamese", "latin"], weight: ["300","400","500","600"], variable: "--f-body" });

/**
 * Lop dat bien phong chu (--f-display, --f-body) len <html>. Tach ra day vi co HAI noi tu dung <html>: layout
 * goc va global-error.tsx (thay the layout goc khi chinh layout goc hong). Cung mot lan goi next/font thi
 * cung mot tep phong da dung san, khong tai hai lan.
 */
export const lopPhong = `${lexend.variable} ${bvp.variable}`;
