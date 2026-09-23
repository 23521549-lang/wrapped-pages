import type { CSSProperties } from "react";
import { netTroi, type NetTroi as Net } from "@/lib/tam-trang/net-troi";
import type { Weather } from "@/lib/tam-trang/troi";

/** Ban kinh nam dai cau vong, tu ngoai vao trong; mau cua tung dai o lop m-cv__1 toi m-cv__5. */
const DAI_CAU_VONG = [160, 151, 142, 133, 124];

/** bien cua net sang style React: bien CSS (--x) giu nguyen ten, thuoc tinh thuong doi sang camelCase. */
function kieu(bien: Net["bien"]): CSSProperties {
  return Object.fromEntries(
    Object.entries(bien).map(([k, v]) => [k.startsWith("--") ? k : k.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase()), v]),
  ) as CSSProperties;
}

function MotNet({ n }: { n: Net }) {
  const lop = `m ${n.lop}`;
  const style = kieu(n.bien);
  switch (n.hinh) {
    case "khoi":
      return <span className={lop} style={style} />;
    case "hat":
      return <i className={lop} style={style} />;
    case "chim":
      return (
        <svg viewBox="0 0 44 24" className={lop} style={style} aria-hidden="true" focusable="false">
          <path d="M2 10 Q8 3 13 9 Q18 3 24 8" />
          <path d="M26 18 Q30 13.5 33.5 17.5 Q37 13.5 41 17" opacity={0.75} />
        </svg>
      );
    case "may":
      return (
        <svg viewBox="0 0 100 44" className={lop} style={style} aria-hidden="true" focusable="false">
          <path className="bong" d="M16 42 C8 42 6 36 12 33 L86 33 C94 36 92 42 84 42Z" opacity={0.55} />
          <path className="than" d="M14 40 C4 40 2 28 12 26 C12 16 26 12 32 20 C36 8 56 6 60 20 C68 12 84 16 82 28 C94 28 96 40 86 40 Z" />
        </svg>
      );
    case "gio":
      return (
        <svg viewBox="0 0 200 36" className={lop} style={style} aria-hidden="true" focusable="false">
          <path d={n.d} />
        </svg>
      );
    case "set":
      return (
        <svg viewBox="0 0 36 60" className={lop} style={style} aria-hidden="true" focusable="false">
          <path d="M22 2 L12 26 L21 26 L9 56" />
        </svg>
      );
    case "cau-vong":
      return (
        <svg viewBox="0 0 400 200" className={lop} style={style} aria-hidden="true" focusable="false">
          {DAI_CAU_VONG.map((r, i) => <path key={r} className={`m-cv__${i + 1}`} d={`M${200 - r} 190 A${r} ${r} 0 0 1 ${200 + r} 190`} />)}
        </svg>
      );
    case "sao":
      return (
        <svg viewBox="0 0 10 10" className={lop} style={style} aria-hidden="true" focusable="false">
          <path d="M5 0 Q5.6 4.4 10 5 Q5.6 5.6 5 10 Q4.4 5.6 0 5 Q4.4 4.4 5 0Z" />
        </svg>
      );
  }
}

/**
 * Net ve dong cua mot bau troi, dat trong nen troi (an voi trinh doc man hinh). Vi tri va nhip cua tung net la bien CSS
 * noi tuyen vi moi troi co toi 90 net lech ngau nhien; hinh va chuyen dong nam trong tam-trang.css, co nhanh giam
 * chuyen dong.
 */
export function NetTroi({ weather }: { weather: Weather }) {
  return <>{netTroi(weather).map((n) => <MotNet key={n.key} n={n} />)}</>;
}
