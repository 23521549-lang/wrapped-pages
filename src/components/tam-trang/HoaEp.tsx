import { HOA_EP, MUC_HOA, type NetHoa } from "@/lib/tam-trang/hoa-ep";
import { FLOWERS, TROI, type Weather } from "@/lib/tam-trang/troi";

/** Mot net cua bong hoa. Mau la currentColor: bong hoa mang mau cua the svg dung no (.hoa). */
function Net({ n }: { n: NetHoa }) {
  switch (n.k) {
    case "to":
      return <path d={n.d} fill="currentColor" opacity={n.o} transform={n.tf} />;
    case "net":
      return <path d={n.d} fill="none" stroke="currentColor" strokeWidth={n.w} strokeLinecap="round" opacity={n.o} />;
    case "cham":
      return <circle cx={n.x} cy={n.y} r={n.r} fill="currentColor" opacity={n.o} />;
    case "vong":
      return <circle cx={n.x} cy={n.y} r={n.r} fill="none" stroke="currentColor" strokeWidth={0.5} opacity={n.o} />;
    case "bau":
      return <ellipse cx={n.x} cy={n.y} rx={n.rx} ry={n.ry} transform={`rotate(${n.a} ${n.x} ${n.y})`} fill="currentColor" opacity={n.o} />;
  }
}

/**
 * Bo loc muc cua hoa va chin bong hoa ep, khai mot lan moi trang dung hoa (ke sach, lich hoa); moi bong hoa chi la mot
 * <use> tro toi day. Khong dat o layout goc: vai tram net nay chi can o hai trang do.
 */
export function HoaDefs() {
  return (
    <svg className="muc-dinh" width="0" height="0" aria-hidden="true" focusable="false">
      <defs>
        <filter id={MUC_HOA} x="-12%" y="-12%" width="124%" height="124%" colorInterpolationFilters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.16 0.22" numOctaves={2} seed={11} result="song" />
          <feDisplacementMap in="SourceGraphic" in2="song" scale={1.5} xChannelSelector="R" yChannelSelector="G" result="xo" />
          <feGaussianBlur in="xo" stdDeviation={0.2} result="nhoe" />
          <feTurbulence type="fractalNoise" baseFrequency="0.32" numOctaves={2} seed={4} result="hat" />
          <feColorMatrix in="hat" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.1 1.5" result="hatA" />
          <feComposite in="nhoe" in2="hatA" operator="in" />
        </filter>
        {FLOWERS.map((k) => (
          <symbol key={k} id={`hoa-${k}`} viewBox="0 0 48 48">
            <g filter={`url(#${MUC_HOA})`}>
              {HOA_EP[k].map((n) => <Net key={n.key} n={n} />)}
            </g>
          </symbol>
        ))}
      </defs>
    </svg>
  );
}

/**
 * Bong hoa ep cua mot kieu troi. Luon an voi trinh doc man hinh: ten kieu troi da co trong chu ben canh. xoay (do) xoay
 * bong hoa quanh tam bang thuoc tinh transform cua <use>, khong can style noi tuyen.
 */
export function Hoa({ weather, xoay = 0, className }: { weather: Weather; xoay?: number; className?: string }) {
  return (
    <svg className={className ? `hoa hoa--${weather} ${className}` : `hoa hoa--${weather}`} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <use href={`#hoa-${TROI[weather].hoa}`} transform={xoay === 0 ? undefined : `rotate(${xoay} 24 24)`} />
    </svg>
  );
}
