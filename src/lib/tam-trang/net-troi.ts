import { rng } from "./hoa-ep";
import type { Weather } from "./troi";

/*
 * Net ve cua moi bau troi (mat troi, may, gio, hat mua, suong, cau vong), chep dung thuat toan cua ban mau da duyet.
 * Moi net la mot phan tu dat tuyet doi trong nen troi; vi tri, kich thuoc, nhip va do tre nam trong bien CSS rieng cua
 * no, con hinh va chuyen dong nam trong src/styles/tam-trang.css. Vi tri lech ngau nhien den tu bo so gia ngau nhien co
 * hat giong theo kieu troi, nen moi lan ve ra y nhu nhau. Ham thuan.
 */

/** Hinh cua mot net: khoi (span), hat mua (i), hay mot SVG nho co dang co dinh. */
export type HinhTroi = "khoi" | "hat" | "chim" | "may" | "gio" | "set" | "cau-vong" | "sao";

export type NetTroi = {
  key: string;
  hinh: HinhTroi;
  /** Lop CSS rieng cua net (m-nang, m-hat, ...); lop chung "m" do thanh phan them. */
  lop: string;
  /** Thuoc tinh CSS dat tren chinh phan tu: vi tri, kich thuoc, bien nhip (--d), tre (--tre), ... Moi gia tri la chuoi. */
  bien: Readonly<Record<string, string>>;
  /** Duong ve cua net gio. */
  d?: string;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

const GIO_CONG = "M2 24 C30 14 60 14 88 20 C112 25 120 12 110 8 C100 5 96 16 108 19 C140 26 170 18 196 12";
const GIO_THANG = "M2 20 C40 8 80 30 120 18 C150 9 170 14 196 22";

type Net = Omit<NetTroi, "key">;

/** n hat mua roi xien, dai va nhanh cham ngau nhien trong khoang cho truoc. */
function mua(R: () => number, n: number, dai: [number, number], toc: [number, number], lech: number, nghieng: number, o: number): Net[] {
  const ra: Net[] = [];
  for (let i = 0; i < n; i++) {
    ra.push({
      hinh: "hat",
      lop: "m-hat",
      bien: {
        left: `${r2(R() * 104 - 2)}%`,
        "--y": `${r2(R() * 88)}%`,
        "--len": `${r2(dai[0] + R() * (dai[1] - dai[0]))}px`,
        "--d": `${r2(toc[0] + R() * (toc[1] - toc[0]))}s`,
        "--tre": `-${r2(R() * 3)}s`,
        "--lech": `${lech}px`,
        "--nghieng": `${nghieng}deg`,
        "--o": `${r2(o * (0.6 + R() * 0.4))}`,
      },
    });
  }
  return ra;
}

function ve(k: Weather): Net[] {
  const R = rng(k.length * 131 + 7);
  const s: Net[] = [];
  switch (k) {
    case "nang-am":
      s.push({ hinh: "khoi", lop: "m-hao", bien: {} }, { hinh: "khoi", lop: "m-nang", bien: {} }, { hinh: "khoi", lop: "m-sang", bien: {} });
      for (let i = 0; i < 9; i++) {
        s.push({
          hinh: "khoi",
          lop: "m-bui",
          bien: {
            left: `${r2(40 + R() * 55)}%`, top: `${r2(20 + R() * 55)}%`, "--d": `${r2(5 + R() * 5)}s`, "--tre": `-${r2(R() * 5)}s`,
            width: `${r2(3 + R() * 3)}px`, height: "auto", "aspect-ratio": "1",
          },
        });
      }
      break;
    case "troi-trong":
      s.push(
        { hinh: "khoi", lop: "m-sang", bien: {} },
        { hinh: "khoi", lop: "m-soi", bien: { left: "8%", top: "22%", width: "30%", "--d": "26s", "--tre": "-4s", "--x": "30px" } },
        { hinh: "khoi", lop: "m-soi", bien: { left: "52%", top: "14%", width: "22%", "--d": "30s", "--tre": "-11s", "--x": "40px" } },
        { hinh: "chim", lop: "m-chim", bien: { left: "62%", top: "26%", "--d": "14s", "--tre": "-2s" } },
      );
      break;
    case "may-nhe":
      for (const [x, y, w, d, tre, dx] of [[4, 16, 150, 34, -6, 30], [34, 48, 110, 42, -14, 24], [58, 8, 190, 50, -20, 40], [82, 44, 120, 38, -3, 26], [-6, 58, 100, 46, -25, 20]]) {
        s.push({ hinh: "may", lop: "m-may", bien: { left: `${x}%`, top: `${y}%`, width: `${w}px`, "--d": `${d}s`, "--tre": `${tre}s`, "--x": `${dx}px` } });
      }
      break;
    case "gio-thoang":
      [[6, 22, 190], [40, 12, 240], [22, 50, 170], [62, 40, 220], [78, 16, 150]].forEach(([x, y, w], i) => {
        s.push({
          hinh: "gio",
          lop: "m-gio",
          d: i % 2 ? GIO_THANG : GIO_CONG,
          bien: { left: `${x}%`, top: `${y}%`, width: `${w}px`, "--d": `${r2(6 + R() * 3)}s`, "--tre": `-${r2(R() * 6)}s` },
        });
      });
      for (let l = 0; l < 7; l++) {
        s.push({
          hinh: "khoi",
          lop: "m-la",
          bien: { left: `${r2(R() * 90)}%`, top: `${r2(12 + R() * 55)}%`, "--d": `${r2(7 + R() * 4)}s`, "--tre": `-${r2(R() * 8)}s`, "--lx": `${r2(R() * 60)}px` },
        });
      }
      break;
    case "mua-phun":
      s.push(...mua(R, 70, [6, 10], [2.4, 3.4], 14, -3, 0.75));
      break;
    case "mua-rao":
      s.push(
        { hinh: "may", lop: "m-may m-may--nen", bien: { left: "10%", top: "-18px", width: "220px", "--d": "34s", "--tre": "-8s", "--x": "24px" } },
        { hinh: "may", lop: "m-may m-may--nen", bien: { left: "58%", top: "-26px", width: "280px", "--d": "40s", "--tre": "-20s", "--x": "30px" } },
        ...mua(R, 90, [14, 24], [0.75, 1.1], 22, -4.5, 0.9),
      );
      break;
    case "giong":
      s.push(
        { hinh: "khoi", lop: "m-chop", bien: {} },
        { hinh: "may", lop: "m-maygiong", bien: { left: "40%", top: "-44px", width: "260px", "--d": "30s", "--tre": "-6s", "--x": "26px" } },
        { hinh: "may", lop: "m-maygiong", bien: { left: "66%", top: "-36px", width: "340px", "--d": "36s", "--tre": "-14s", "--x": "30px" } },
        { hinh: "set", lop: "m-set", bien: { left: "70%", top: "28px", "--tre": "0s" } },
        ...mua(R, 70, [16, 22], [0.7, 0.95], -48, 9, 0.85),
      );
      break;
    case "suong-mu":
      for (const [y, h, o, d, tre] of [[6, 40, 0.95, 26, -4], [28, 56, 0.8, 34, -12], [52, 48, 0.9, 22, -8], [74, 60, 0.7, 30, -18], [-10, 70, 0.6, 40, -2]]) {
        s.push({ hinh: "khoi", lop: "m-suong", bien: { top: `${y}%`, "--h": `${h}px`, "--o": `${o}`, "--d": `${d}s`, "--tre": `${tre}s` } });
      }
      break;
    case "cau-vong":
      s.push({ hinh: "cau-vong", lop: "m-cv", bien: {} });
      [[18, 30], [36, 18], [8, 60], [48, 44], [26, 64]].forEach(([x, y], i) => {
        s.push({ hinh: "sao", lop: "m-sao", bien: { left: `${x}%`, top: `${y}%`, "--d": `${3.5 + i * 0.7}s`, "--tre": `-${i * 1.1}s` } });
      });
      break;
  }
  return s;
}

/** Net ve cua mot bau troi, kem khoa React on dinh. */
export function netTroi(k: Weather): NetTroi[] {
  return ve(k).map((n, i) => Object.assign(n, { key: `${k}-${i}` }));
}
