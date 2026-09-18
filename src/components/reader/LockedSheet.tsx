import type { CSSProperties } from "react";

/** Do dai vach (phan tram be rong dong), lay lan luot; dong cuoi doan lay ngan hon. Co dinh nen lan ve nao cung giong nhau. */
const DAI = [96, 91, 99, 88, 94, 97, 90, 93];
const DAI_CUOI = [62, 45, 71, 38, 56, 49];
/** So dong cua tung doan vach: sau dong he lo, va cho to khong co dong he lo. Deu vua vung chu 460px. */
const DOAN_SAU_HE_LO = [4, 3, 5];
const DOAN_TRON = [[5, 4, 5], [1, 4, 3, 3]];

type Doan = { key: string; dong: { key: string; dai: string }[] };

function vach(doan: readonly number[], lech: number): Doan[] {
  let dem = lech;
  return doan.map((soDong, j) => ({
    key: `d${j}`,
    dong: Array.from({ length: soDong }, (_, i) => {
      const cuoi = soDong > 1 && i === soDong - 1;
      const dai = cuoi ? DAI_CUOI[(j + lech) % DAI_CUOI.length] : DAI[dem % DAI.length];
      dem += 1;
      return { key: `d${j}-${i}`, dai: `${dai}%` };
    }),
  }));
}

/** Dau niem phong nho o goc tren cua to. */
export function SealMark({ label }: { label: string }) {
  return (
    <span className="dau-niem">
      <svg viewBox="0 0 12 12" aria-hidden="true">
        <rect x="2.25" y="5.25" width="7.5" height="5.5" rx="1.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d="M4 5.25V3.9a2 2 0 0 1 4 0v1.35" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
      {label}
    </span>
  );
}

/**
 * Phan ben trong cua mot to dang niem phong. Dong he lo la chu that do may chu cat san; phan
 * "chu nhoe" la cac vach trang tri do trinh duyet ve, khong co chu nao, vi chu that khong bao gio duoc gui
 * xuong. index chi de moi to co nhip vach hoi khac nhau.
 */
export function LockedSheet({ teaser, index }: { teaser: string | null; index: number }) {
  const doan = vach(teaser ? DOAN_SAU_HE_LO : DOAN_TRON[index % DOAN_TRON.length], index);
  return (
    <>
      <SealMark label="Đang niêm phong" />
      <div className="giay-noi-dung">
        {teaser && <p>{teaser}</p>}
        <div className="nhoe" aria-hidden="true">
          {doan.map((d) => (
            <span key={d.key} className="nhoe__doan">
              {d.dong.map((x) => (
                <span key={x.key} className="nhoe__dong" style={{ "--dai": x.dai } as CSSProperties} />
              ))}
            </span>
          ))}
        </div>
        <p className="sr-only">{teaser ? "Phần còn lại của trang đang niêm phong." : "Trang đang niêm phong."}</p>
      </div>
    </>
  );
}
