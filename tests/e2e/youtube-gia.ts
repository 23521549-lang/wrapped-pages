import type { Page } from "@playwright/test";
import type { KhungChuNhat } from "@/lib/viewport";

/**
 * YouTube IFrame API gia, tra thay cho https://www.youtube.com/iframe_api. YT.Player thay moc bang mot iframe that
 * (about:blank, 320x200), bao onReady sau mot nhip, dem so lan tao, phat va dung vao window.ytGia. playVideo() that
 * chi gui mot postMessage toi iframe, ma iframe nhan va thuc su bat dau phat o mot tac vu sau; ban gia mo phong dung
 * do tre do bang setTimeout(0): ghi so lan phat va khung cua iframe (window.ytGiaLucPhat) o mot tac vu ke tiep, chu
 * khong ngay trong playVideo(). Nho vay test kiem duoc bo cuc THAT SU luc phat, khong phai luc goi playVideo(). Trang
 * thai phat chi doi khi test goi window.ytGiaBao(ma), de kiem nhan nut theo su kien that chu khong theo cu bam.
 */
const YT_GIA = [
  "(() => {",
  "  const ghi = { created: 0, play: 0, pause: 0 };",
  "  const lucPhat = [];",
  "  const cacMay = [];",
  "  window.ytGia = ghi;",
  "  window.ytGiaLucPhat = lucPhat;",
  "  window.ytGiaBao = (data) => { for (const m of cacMay) m.opts.events.onStateChange({ target: m, data }); };",
  "  class Player {",
  "    constructor(el, opts) {",
  "      ghi.created += 1;",
  "      this.opts = opts;",
  "      this.khung = document.createElement('iframe');",
  "      this.khung.src = 'about:blank';",
  "      this.khung.width = '320';",
  "      this.khung.height = '200';",
  "      el.replaceWith(this.khung);",
  "      cacMay.push(this);",
  "      setTimeout(() => opts.events.onReady({ target: this }), 0);",
  "    }",
  "    getIframe() { return this.khung; }",
  "    playVideo() {",
  "      setTimeout(() => {",
  "        ghi.play += 1;",
  "        const r = this.khung.getBoundingClientRect();",
  "        lucPhat.push({ top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height, rong: innerWidth, cao: innerHeight });",
  "      }, 0);",
  "    }",
  "    pauseVideo() { ghi.pause += 1; }",
  "    destroy() { this.khung.remove(); }",
  "  }",
  "  window.YT = { Player };",
  "  if (window.onYouTubeIframeAPIReady) window.onYouTubeIframeAPIReady();",
  "})();",
].join(" ");

export type GhiYt = { created: number; play: number; pause: number };

/** Khung cua iframe va kich thuoc khung nhin ngay luc goi playVideo. */
export type LucPhat = KhungChuNhat & { rong: number; cao: number };

/**
 * Cat moi request toi YouTube, tru iframe_api tra ban gia. Route dang ky sau chay truoc. Moi spec mo man doc cua mot
 * cuon co nhac goi ham nay cho tung trang truoc lan goto dau tien cua trang do (Global Constraints).
 */
export async function giaYoutube(page: Page): Promise<void> {
  const ctx = page.context();
  await ctx.route(/youtube(-nocookie)?[.]com/, (r) => r.abort());
  await ctx.route("https://www.youtube.com/iframe_api", (r) => r.fulfill({ contentType: "text/javascript", body: YT_GIA }));
}

export function ghiYt(page: Page): Promise<GhiYt> {
  return page.evaluate(() => (window as unknown as { ytGia: GhiYt }).ytGia);
}

export async function baoYt(page: Page, ma: number): Promise<void> {
  await page.evaluate((m) => (window as unknown as { ytGiaBao: (m: number) => void }).ytGiaBao(m), ma);
}

export function lucPhat(page: Page): Promise<LucPhat[]> {
  return page.evaluate(() => (window as unknown as { ytGiaLucPhat: LucPhat[] }).ytGiaLucPhat);
}
