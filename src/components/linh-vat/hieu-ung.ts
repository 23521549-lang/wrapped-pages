import { CAM_XUC, type LoaiCamXuc } from "@/lib/cam-xuc";

/*
 * Hieu ung tha cam xuc (5d, spec C7, D4): moi cam xuc mot man ngan (khoang 3,6 giay) ve bang hat DOM trong mot lop co
 * dinh phu ca man, pointer-events: none, aria-hidden (ngoai le chu du an duyet: lop nay duoc de len moi thu, ke ca khung
 * YouTube). Hat chi chay bang CSS keyframes tren transform va opacity (linh-vat.css), toa do va nhip truyen qua bien CSS.
 * Nhanh giam chuyen dong khong goi toi day (va CSS an ca lop). Ham tra ve ham don: huy moi hen gio, go moi hat.
 */

/** Anh hat hieu ung (Fluent Emoji 3D, MIT), tu phuc vu cung linh vat. */
const HAT = {
  tim: "/linh-vat/tim.webp",
  timLapLanh: "/linh-vat/tim-lap-lanh.webp",
  timLon: "/linh-vat/tim-lon.webp",
  vetSon: "/linh-vat/vet-son.webp",
  lapLanh: "/linh-vat/lap-lanh.webp",
  giot: "/linh-vat/giot.webp",
  dauGian: "/linh-vat/dau-gian.webp",
  vaCham: "/linh-vat/va-cham.webp",
} as const;

/** Tam linh vat, tu ma cam xuc. */
const linhVat = (loai: LoaiCamXuc) => CAM_XUC[loai].anh;

/** Diem xuat phat cua hieu ung: tam linh vat, toa do man hinh. */
export type Goc = { x: number; y: number };

type Man = {
  lop: HTMLElement;
  goc: Goc;
  w: number;
  h: number;
  /** Hen mot viec sau ms (duoc huy khi don). */
  sau: (ms: number, f: () => void) => void;
  /** Tao mot hat: lop CSS, anh, bien CSS; tu go sau ms. */
  hat: (lop: string, anh: string, bien: Record<string, string>, ms: number, longAnh?: boolean) => HTMLElement;
  /** So ngau nhien trong [a, b). */
  r: (a: number, b: number) => number;
};

const px = (n: number) => `${Math.round(n)}px`;

const MAN: Record<LoaiCamXuc, (m: Man) => void> = {
  // Ban tim lien thanh: tim bay vong cung tu linh vat ra khap man, 85ms mot phat, cu nam phat co mot tim lap lanh.
  yeu({ goc, w, h, sau, hat, r }) {
    for (let i = 0; i < 28; i++) sau(i * 85, () => {
      const t = r(1000, 1400);
      const dinh = r(h * 0.05, h * 0.55);
      hat("hv-tim", i % 5 === 4 ? HAT.timLapLanh : HAT.tim, {
        "--co": px(r(28, 54)), "--t": `${Math.round(t)}ms`, "--x0": px(goc.x - 20), "--x1": px(r(w * 0.25, w * 1.02)),
        "--y0": px(goc.y - 20), "--yd": px(dinh), "--y1": px(dinh + r(80, 220)), "--r0": `${Math.round(r(-30, 30))}deg`, "--r1": `${Math.round(r(-25, 25))}deg`,
      }, t + 60, true);
    });
  },
  // Nho: vet son va tim lon dan bay len tu mep duoi nhu den troi, dung dua.
  nho({ w, h, sau, hat, r }) {
    for (let i = 0; i < 14; i++) sau(i * 140, () => {
      const t = r(2600, 3200);
      hat("hv-bay", i % 2 ? HAT.vetSon : HAT.timLon, { "--co": px(r(34, 56)), "--t": `${Math.round(t)}ms`, "--x0": px(r(0.05, 0.92) * w), "--y0": px(h + 20), "--y1": px(r(0.05, 0.4) * h) }, t + 60, true);
    });
  },
  // Vui: lap lanh no ra roi tat khap man, xen vai ca heo nho.
  vui({ w, h, sau, hat, r }) {
    for (let i = 0; i < 22; i++) sau(i * 110, () => {
      const x = r(0.05, 0.9) * w;
      const y = r(0.1, 0.85) * h;
      hat("hv-no", i % 4 === 3 ? linhVat("vui") : HAT.lapLanh, { "--co": px(r(30, 58)), "--t": "900ms", "--x0": px(x), "--y0": px(y + 30), "--x1": px(x + r(-30, 30)), "--y1": px(y) }, 960);
    });
  },
  // Buon: man mo xanh nhat, mua giot nuoc roi.
  buon({ lop, w, h, sau, hat, r }) {
    const man = document.createElement("div");
    man.className = "hv-man-mua";
    lop.append(man);
    sau(3700, () => man.remove());
    for (let i = 0; i < 40; i++) sau(r(0, 2600), () => {
      const t = r(900, 1300);
      hat("hv-giot", HAT.giot, { "--co": px(r(14, 26)), "--t": `${Math.round(t)}ms`, "--x0": px(r(0, 1) * w), "--y1": px(h + 40) }, t + 60);
    });
  },
  // Gian: ho con lao vao giua man, cu va cham, vet nut kinh toa ra, dau gian bat ra; lop hieu ung rung.
  gian({ lop, goc, w, h, sau, hat, r }) {
    const x = w * r(0.45, 0.6);
    const y = h * r(0.35, 0.5);
    hat("hv-lao", linhVat("gian"), { "--xa": px(goc.x), "--ya": px(goc.y), "--x0": px(x), "--y0": px(y) }, 600);
    const vo = document.createElement("div");
    vo.className = "hv-nut";
    vo.style.left = px(x);
    vo.style.top = px(y);
    vo.innerHTML = VET_NUT;
    lop.append(vo);
    sau(4100, () => vo.remove());
    hat("hv-va-cham", HAT.vaCham, { "--x0": px(x), "--y0": px(y) }, 1400);
    for (let i = 0; i < 5; i++) sau(420 + i * 160, () => {
      const a = r(0, Math.PI * 2);
      const d = r(90, 200);
      hat("hv-no", HAT.dauGian, { "--co": px(r(34, 50)), "--t": "1000ms", "--x0": px(x), "--y0": px(y), "--x1": px(x + Math.cos(a) * d), "--y1": px(y + Math.sin(a) * d) }, 1060);
    });
    lop.classList.add("hieu-ung--rung");
    sau(900, () => lop.classList.remove("hieu-ung--rung"));
  },
  // Bat ngo: ba vong song toa tu linh vat, lap lanh ban len.
  "bat-ngo"({ goc, sau, hat, r }) {
    for (let i = 0; i < 3; i++) sau(i * 260, () => hat("hv-vong", "", { "--x0": px(goc.x), "--y0": px(goc.y) }, 1160));
    for (let i = 0; i < 10; i++) sau(200 + i * 60, () => {
      const a = r(-Math.PI * 0.95, -Math.PI * 0.05);
      const d = r(120, 320);
      hat("hv-no", HAT.lapLanh, { "--co": px(r(26, 40)), "--t": "900ms", "--x0": px(goc.x), "--y0": px(goc.y), "--x1": px(goc.x + Math.cos(a) * d + 120), "--y1": px(goc.y + Math.sin(a) * d) }, 960);
    });
  },
  // Treu: khi con roi goc, nhun nhay chay ngang day man roi quay dau chay ve; lap lanh roi lai phia sau.
  treu({ w, h, sau, hat, r }) {
    hat("hv-chay", linhVat("treu"), { "--y0": px(h - 16 - 100), "--x1": px(w - 110) }, 3060, true);
    for (let i = 0; i < 8; i++) sau(300 + i * 320, () => {
      const x = r(0.1, 0.9) * w;
      const y = h - r(120, 220);
      hat("hv-no", HAT.lapLanh, { "--co": "28px", "--t": "800ms", "--x0": px(x), "--y0": px(y), "--x1": px(x), "--y1": px(y - 30) }, 860);
    });
  },
  // Biet on: tim lap lanh bay len tu linh vat.
  "biet-on"({ goc, h, sau, hat, r }) {
    for (let i = 0; i < 12; i++) sau(i * 180, () => {
      const t = r(2400, 3000);
      hat("hv-bay", i % 3 ? HAT.timLapLanh : HAT.lapLanh, { "--co": px(r(30, 50)), "--t": `${Math.round(t)}ms`, "--x0": px(goc.x + r(-20, 260)), "--y0": px(goc.y), "--y1": px(r(0.1, 0.45) * h) }, t + 60, true);
    });
  },
};

/** Loai cam xuc dang chay ma linh vat roi goc (khi con chay ngang man, ho con lao toi dam): linh vat o goc an bay lau. */
export const VANG_MAT: Partial<Record<LoaiCamXuc, number>> = { treu: 3000, gian: 560 };

/**
 * Chay hieu ung cua mot cam xuc trong lop (the .hieu-ung da gan vao trang). Tra ham don: huy moi hen gio chua chay, go
 * moi hat va vet nut con lai. ngauNhien de bai kiem co dinh duoc (mac dinh Math.random).
 */
export function dienHieuUng(loai: LoaiCamXuc, lop: HTMLElement, goc: Goc, ngauNhien: () => number = Math.random): () => void {
  const hen = new Set<ReturnType<typeof setTimeout>>();
  const m: Man = {
    lop, goc, w: innerWidth, h: innerHeight,
    r: (a, b) => a + ngauNhien() * (b - a),
    sau(ms, f) {
      const id = setTimeout(() => {
        hen.delete(id);
        f();
      }, ms);
      hen.add(id);
    },
    hat(lopHat, anh, bien, ms, longAnh = false) {
      const el = document.createElement("div");
      el.className = `hv ${lopHat}`;
      for (const [k, v] of Object.entries(bien)) el.style.setProperty(k, v);
      if (anh !== "") {
        const img = document.createElement("img");
        img.src = anh;
        img.alt = "";
        img.decoding = "async";
        if (longAnh) {
          // Hai lop: lop ngoai di mot truc, lop trong di truc kia (vong cung, dung dua, nhun).
          const trong = document.createElement("div");
          trong.className = "hv__trong";
          trong.append(img);
          el.append(trong);
        } else {
          el.append(img);
        }
      }
      lop.append(el);
      m.sau(ms, () => el.remove());
      return el;
    },
  };
  MAN[loai](m);
  return () => {
    for (const id of hen) clearTimeout(id);
    hen.clear();
    lop.replaceChildren();
    lop.classList.remove("hieu-ung--rung");
  };
}

/*
 * Vet nut kinh cua cam xuc Gian: muoi tia gay khuc co nhanh va vai doan noi giua hai tia canh nhau (manh kinh vo), net
 * muc --blue-ink co vien sang --color-giay. Sinh mot lan tu hat co dinh nen luc nao cung mot hinh (khong ngau nhien
 * luc chay) va chi la chuoi SVG tinh, hien bang opacity va scale.
 */
const VET_NUT = (() => {
  let hat = 7;
  const rd = () => {
    hat = (hat * 16807) % 2147483647;
    return hat / 2147483647;
  };
  const tia: string[] = [];
  const nhanh: string[] = [];
  const noi: string[] = [];
  const N = 10;
  const diem: [number, number][][] = [];
  for (let i = 0; i < N; i++) {
    const a0 = (i / N) * Math.PI * 2 + (rd() - 0.5) * 0.45;
    let x = 50;
    let y = 50;
    let d = "M50 50";
    const cacDiem: [number, number][] = [];
    const dai = 30 + rd() * 20;
    const buoc = 5 + Math.floor(rd() * 2);
    for (let k = 1; k <= buoc; k++) {
      const a = a0 + (rd() - 0.5) * 0.5;
      const l = (dai / buoc) * (0.7 + rd() * 0.6);
      x += Math.cos(a) * l;
      y += Math.sin(a) * l;
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
      cacDiem.push([x, y]);
      if (k === 2 || (k === 3 && rd() > 0.5)) {
        const an = a + (rd() > 0.5 ? 1 : -1) * (0.45 + rd() * 0.35);
        let bx = x;
        let by = y;
        let bd = `M${x.toFixed(1)} ${y.toFixed(1)}`;
        for (let n = 0; n < 2; n++) {
          const l2 = 3 + rd() * 5;
          bx += Math.cos(an + (rd() - 0.5) * 0.4) * l2;
          by += Math.sin(an + (rd() - 0.5) * 0.4) * l2;
          bd += ` L${bx.toFixed(1)} ${by.toFixed(1)}`;
        }
        nhanh.push(bd);
      }
    }
    tia.push(d);
    diem.push(cacDiem);
  }
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    for (const k of [0, 2]) {
      const p1 = diem[i][k];
      const p2 = diem[j][k];
      if (rd() < 0.35 || p1 === undefined || p2 === undefined) continue;
      const mx = (p1[0] + p2[0]) / 2 + (rd() - 0.5) * 3;
      const my = (p1[1] + p2[1]) / 2 + (rd() - 0.5) * 3;
      noi.push(`M${p1[0].toFixed(1)} ${p1[1].toFixed(1)} L${mx.toFixed(1)} ${my.toFixed(1)} L${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`);
    }
  }
  const tatCa = [...tia, ...nhanh, ...noi].map((d) => `<path d="${d}"/>`).join("");
  return `<svg viewBox="0 0 100 100" aria-hidden="true"><g class="hv-nut__sang" transform="translate(.35 .35)">${tatCa}</g><g class="hv-nut__muc">${tatCa}</g><circle class="hv-nut__tam" cx="50" cy="50" r="2.2"/></svg>`;
})();
