/*
 * Nhip cua hieu ung ROI SANG, dung khi khung sach lon doi bia. Mot vet sang truot ngang qua khung, bia cu mo di ngay
 * sau vet, bia moi nam san o duoi va khong bi dong vao.
 *
 * Vi sao roi sang chu khong phai giay tham nuoc nhu bau troi: bia doi muoi giay mot lan suot ca ngay trong khoe mat,
 * nen phai re. Do that cho thay giay tham nuoc la cach DUY NHAT rot xuong duoi 60 khung hinh, con roi sang chi ba the
 * va phep bu la phep truot nen chinh xac tuyet doi, khong phai lay mau lai.
 *
 * Mo dun thuan, khong nhap react hay dom: chi tra ve cac day khung hinh va nhip, de kiem duoc bang ham thuan.
 */

/** Mot lan doi bia keo dai chung nay. Chu du an chot khoang mot giay (diem 24). */
export const ROI_SANG_MS = 1020;

/** Cach nhau chung nay giua hai lan doi bia. Chu du an chot muoi giay (diem 16 va 24). */
export const DOI_BIA_MS = 10_000;

/** Cho hieu ung don xong han roi moi hen lan sau: khong bao gio co hai lan doi chong nhau. */
export const DON_TRE_MS = 60;

/** Nhip cua vet sang: vao nhanh, ra cham, khong giat o hai dau. */
const NHIP_VET = "cubic-bezier(0.32, 0, 0.24, 1)";
/** Bia cu mo di ngay sau vet, nen bat dau muon hon mot chut va ket thuc som hon vet. */
const NHIP_CU = "cubic-bezier(0.4, 0, 0.6, 1)";

/**
 * Vet sang: mot dai hep truot tu ngoai mep trai sang ngoai mep phai. Dat theo phan tram be rong cua chinh khung, nen
 * khung rong bao nhieu cung dung mot day khung hinh. Chi transform va opacity.
 */
export function khungVetSang(): Keyframe[] {
  return [
    { transform: "translate3d(-130%, 0, 0)", opacity: 0, offset: 0 },
    { transform: "translate3d(-60%, 0, 0)", opacity: 1, offset: 0.18 },
    { transform: "translate3d(60%, 0, 0)", opacity: 1, offset: 0.82 },
    { transform: "translate3d(130%, 0, 0)", opacity: 0, offset: 1 },
  ];
}

/** Bia cu: dung yen roi mo han di trong luc vet di qua. Chi opacity, khong dong vao bia moi nam duoi. */
export function khungBiaCu(): Keyframe[] {
  return [
    { opacity: 1, offset: 0 },
    { opacity: 1, offset: 0.22 },
    { opacity: 0, offset: 0.78 },
    { opacity: 0, offset: 1 },
  ];
}

/** Ken chung cua ca hai day khung hinh. `fill: "forwards"` de buoc don la noi duy nhat tra mat bia ve. */
export function kenVetSang(): KeyframeAnimationOptions {
  return { duration: ROI_SANG_MS, easing: NHIP_VET, fill: "forwards" };
}

export function kenBiaCu(): KeyframeAnimationOptions {
  return { duration: ROI_SANG_MS, easing: NHIP_CU, fill: "forwards" };
}
