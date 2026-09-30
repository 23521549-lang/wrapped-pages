/*
 * Chim dua thu (dot nam 5b, spec F): mot con chim net muc (cung bo loc #muc-loang cua tranh bia, khai o layout goc) vo canh
 * bay theo duong cong offset-path. Chi transform, opacity va offset-path; giam chuyen dong thi khong co chim, cac ham tra ve
 * ngay. Phan tu duoc dung bang chuoi SVG hang so (khong co chu cua nguoi dung nao), gan vao noi goi chi dinh: body, hay
 * chinh hop thoai dang mo (hop thoai modal nam o lop tren cung, chim ngoai no se bi che).
 */

export const GIAM_CHUYEN_DONG = "(prefers-reduced-motion: reduce)";

export function giamChuyenDong(): boolean {
  return globalThis.matchMedia?.(GIAM_CHUYEN_DONG).matches ?? false;
}

/** Phong bi giay: nen giay (gradient #giay-phong khai mot lan o LaThuBay), nep sau, nap, dau sap xanh co bong hoa nho. */
export const PHONG_SVG = `<svg class="phong" viewBox="0 0 96 68" aria-hidden="true" focusable="false">
<rect x="3" y="6" width="90" height="58" rx="4" fill="url(#giay-phong)" stroke="currentColor" stroke-width="1.6"/>
<path d="M4 63 38 36M92 63 58 36" fill="none" stroke="currentColor" stroke-width="1.1" opacity=".45"/>
<path class="phong__nap" d="M4 8 48 40 92 8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
<circle cx="48" cy="40" r="8.5" fill="var(--blue-2)" stroke="var(--blue-line)" stroke-width="1.4"/>
<path d="M48 35.5c1.3 1.6 1.3 3 0 4.5-1.3-1.5-1.3-2.9 0-4.5ZM52.5 40c-1.6 1.3-3 1.3-4.5 0 1.5-1.3 2.9-1.3 4.5 0ZM48 44.5c-1.3-1.6-1.3-3 0-4.5 1.3 1.5 1.3 2.9 0 4.5ZM43.5 40c1.6-1.3 3-1.3 4.5 0-1.5 1.3-2.9 1.3-4.5 0Z" fill="currentColor" opacity=".7"/></svg>`;

/** Chim net muc quay sang phai: canh sau, than, duoi, dau, mo, canh truoc; mot soi day buoc phong bi duoi chan. */
const CHIM_SVG = `<svg class="chim" viewBox="0 0 120 80" aria-hidden="true" focusable="false">
<g filter="url(#muc-loang)">
<path class="chim__canh chim__canh--sau" d="M58 40C50 20 40 8 22 2c10 14 18 28 30 42Z" fill="currentColor"/>
<path d="M24 45 4 36l5 10-7 9 24-5Z" fill="currentColor" opacity=".8"/>
<path d="M20 46c14-16 50-18 66-10 8 4 10 10 4 14-14 10-50 10-70-4Z" fill="currentColor" opacity=".88"/>
<circle cx="89" cy="35" r="10" fill="currentColor" opacity=".92"/>
<path d="m98 34 12 3-12 3Z" fill="currentColor"/>
<circle cx="92.5" cy="32.5" r="1.5" fill="var(--color-paper)"/>
<path class="chim__canh chim__canh--truoc" d="M62 42C58 16 48 2 30-2c10 16 16 30 24 48Z" fill="currentColor" opacity=".75"/>
</g>
<path d="M66 54v14" stroke="currentColor" stroke-width="1" opacity=".6"/></svg>`;

type Diem = readonly [number, number];

function taoChim(noi: HTMLElement, coThu: boolean): HTMLElement {
  const chim = document.createElement("div");
  chim.className = "chim-bay";
  chim.setAttribute("aria-hidden", "true");
  chim.innerHTML = `<div class="chim-bay__than">${CHIM_SVG}<span class="chim-bay__thu"${coThu ? "" : " hidden"}>${PHONG_SVG}</span></div>`;
  noi.append(chim);
  return chim;
}

/** Bay theo mot duong Bezier bac ba (toa do khung nhin, phan tu position: fixed o goc 0 0). */
function bay(chim: HTMLElement, [x0, y0]: Diem, [c1x, c1y]: Diem, [c2x, c2y]: Diem, [x1, y1]: Diem, ms: number, easing: string): Promise<unknown> {
  chim.style.setProperty("offset-path", `path("M ${x0} ${y0} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x1} ${y1}")`);
  return chim.animate([{ offsetDistance: "0%" }, { offsetDistance: "100%" }], { duration: ms, easing, fill: "forwards" }).finished;
}

const cho = (ms: number) => new Promise<void>((xong) => {
  setTimeout(xong, ms);
});

/** Phan tu co ho tro WAAPI khong (jsdom thi khong): khong co thi bo qua hoat canh. */
const coHoatAnh = (el: HTMLElement) => typeof el.animate === "function";

/**
 * Gui thu: to giay gap thanh phong bi; chim tu goc tren ben phai sa xuong, luon lo tren phong bi mot nhip, ngam lay roi
 * bay vong len goc tren ben phai, nho dan. Xong thi tra ve; giam chuyen dong thi to giay chi mo di.
 */
export async function chimDenLay(la: HTMLElement): Promise<void> {
  if (!coHoatAnh(la)) return;
  if (giamChuyenDong()) {
    await la.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 150, fill: "forwards" }).finished;
    return;
  }
  const noi = la.closest("dialog") ?? document.body;
  const r = la.getBoundingClientRect();
  const p: Diem = [r.left + r.width / 2, r.top + r.height / 2];
  const phong = document.createElement("div");
  phong.className = "thu-cho";
  phong.setAttribute("aria-hidden", "true");
  phong.innerHTML = PHONG_SVG;
  phong.style.left = `${p[0] - 36}px`;
  phong.style.top = `${p[1] - 26}px`;
  noi.append(phong);
  try {
    la.animate([
      { transform: "none", opacity: 1 },
      { transform: "perspective(900px) rotateX(55deg) scale(.55)", opacity: 0.7, offset: 0.6 },
      { transform: "perspective(900px) rotateX(82deg) scale(.2)", opacity: 0 },
    ], { duration: 560, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" });
    await phong.animate([{ opacity: 0, transform: "scale(.4)" }, { opacity: 1, transform: "scale(1)" }], {
      duration: 380, delay: 380, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards",
    }).finished;
    const chim = taoChim(noi, false);
    try {
      chim.classList.add("chim-bay--trai");
      const tren: Diem = [p[0], p[1] - 52];
      await bay(chim, [innerWidth + 90, -70], [innerWidth - 120, 60], [p[0] + 170, p[1] - 150], tren, 1150, "cubic-bezier(.25,.1,.2,1)");
      const than = chim.querySelector<HTMLElement>(".chim-bay__than");
      await than?.animate([
        { transform: "scaleX(-1) translateY(0)" }, { transform: "scaleX(-1) translateY(6px)" }, { transform: "scaleX(-1) translateY(0)" },
      ], { duration: 320, easing: "ease-in-out" }).finished;
      phong.remove();
      chim.querySelector<HTMLElement>(".chim-bay__thu")?.removeAttribute("hidden");
      chim.classList.remove("chim-bay--trai");
      than?.animate([{ transform: "scale(1) rotate(0)" }, { transform: "scale(.5) rotate(-10deg)" }], { duration: 1700, easing: "ease-in", fill: "forwards" });
      await bay(chim, tren, [p[0] - 90, p[1] - 140], [innerWidth - 220, 40], [innerWidth + 140, -130], 1700, "cubic-bezier(.45,0,.3,1)");
    } finally {
      chim.remove();
    }
  } finally {
    phong.remove();
  }
}

/**
 * Thu toi: chim mang thu bay tu mep phai toi ngay tren cho la thu (dich), tha thu xuong roi bay di. Xong khi chim vua tha
 * thu (noi goi hien la thu luc do); chim tu bay di roi tu go.
 */
export async function chimMangToi(dich: HTMLElement): Promise<void> {
  if (!coHoatAnh(dich) || giamChuyenDong()) return;
  const r = dich.getBoundingClientRect();
  const f: Diem = [r.left + r.width / 2, r.top + r.height / 2 - 52];
  const chim = taoChim(document.body, true);
  chim.classList.add("chim-bay--trai");
  try {
    await bay(chim, [innerWidth + 90, f[1] + 170], [innerWidth - 40, f[1] + 200], [f[0] + 120, f[1] - 20], f, 1500, "cubic-bezier(.3,.1,.2,1)");
    await cho(260);
  } catch {
    chim.remove();
    return;
  }
  chim.querySelector<HTMLElement>(".chim-bay__thu")?.setAttribute("hidden", "");
  chim.classList.remove("chim-bay--trai");
  void bay(chim, f, [f[0] + 60, f[1] - 90], [innerWidth - 60, -40], [innerWidth + 120, -110], 1100, "cubic-bezier(.5,0,.4,1)")
    .finally(() => chim.remove());
}
