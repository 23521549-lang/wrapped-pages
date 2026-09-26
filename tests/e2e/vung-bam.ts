import { expect, type Page } from "@playwright/test";
import { moSach, tranNgang } from "./kho-sach";

/*
 * Buoc do dung chung cho vung bam 44px va tran ngang tren moi man. Ca hai do deu chung mot buoc di qua
 * man vi cung chay tren cac man giong nhau, nen khong the dat cai nay ma truot cai kia.
 *
 * Khong doan bo chon (doan sai ten lop, vd .bia trong khi lop that la .book__cover, lam do bo sot phan tu).
 * vungBamNho lay phan tu theo VAI TRO chung - a, button, input, select, textarea, [role="button"], va
 * phan tu co tabindex khong am - khong theo ten lop cua rieng man nao.
 */

/** Be rong cam ung dung cho phep do vung bam (chi doi hoi 44px o be rong cam ung). */
export const BE_RONG_CHAM = 375;

/** Bon be rong phai khong tran ngang. */
export const BE_RONG = [320, 375, 414, 768];

const VAI_TRO_CO_BAN = 'a, button, input, select, textarea, [role="button"]';
const VAI_TRO_BAM = `${VAI_TRO_CO_BAN}, [tabindex]`;

/**
 * Do vung bam cua moi phan tu dang hien tren trang dang mo, tra danh sach mo ta nhung phan tu co
 * canh ngan (min(rong, cao)) duoi 44px. Rong nghia la dat.
 *
 * Do trong MOT lan page.evaluate: moi kich thuoc so sanh voi nhau phai
 * doc trong cung mot khung hinh, khong doc rai rac qua nhieu lan goi lai frame co the da ve lai giua
 * chung.
 *
 * mienTru nhan tu cho GOI (khong chon san trong ham nay). Mien tru KHONG phai bo qua: phan tu khop
 * `phanTu` duoc do bang to tien gan nhat khop `vungBam` - vung bam that ma co che CSS cua no mo rong ra
 * (vd nhan boc mot radio, hay mot ::after phu kin ca the) - va to tien do van phai du 44px. Khong tim
 * thay to tien do la mot loi bao ra, khong phai mot lan lang le bo qua. Chu thich co che CSS phai viet
 * tai cho goi.
 */
export type MienTru = { phanTu: string; vungBam: string };

export async function vungBamNho(page: Page, mienTru: MienTru[] = []): Promise<string[]> {
  return page.evaluate(
    ({ vaiTroCoBan, vaiTroBam, mienTruTrongTrang }) => {
      const ket: string[] = [];
      /** Phan tu bi mien tru -> phan tu duoc do thay (vung bam that), hoac null neu khong tim thay. */
      const doThay = new Map<Element, Element | null>();
      for (const { phanTu, vungBam } of mienTruTrongTrang) {
        for (const el of Array.from(document.querySelectorAll(phanTu))) doThay.set(el, el.closest(vungBam));
      }

      const biAn = (el: Element): boolean => {
        if ((el as HTMLElement).hidden) return true;
        const kieu = getComputedStyle(el);
        if (kieu.display === "none" || kieu.visibility === "hidden") return true;
        let cha = el.parentElement;
        while (cha) {
          if ((cha as HTMLElement).hidden) return true;
          const kieuCha = getComputedStyle(cha);
          if (kieuCha.display === "none" || kieuCha.visibility === "hidden") return true;
          cha = cha.parentElement;
        }
        return false;
      };

      const bDisabled = (el: Element): boolean =>
        (el as { disabled?: boolean }).disabled === true || el.getAttribute("aria-disabled") === "true";

      const tenKhaTruy = (el: Element): string => {
        const aria = el.getAttribute("aria-label");
        if (aria) return aria;
        const nhanTheo = (el.getAttribute("aria-labelledby") ?? "")
          .split(/\s+/)
          .map((ma) => document.getElementById(ma)?.textContent?.trim() ?? "")
          .filter(Boolean)
          .join(" ");
        if (nhanTheo) return nhanTheo;
        const chu = (el.textContent ?? "").trim().replace(/\s+/g, " ");
        if (chu) return chu.length > 40 ? `${chu.slice(0, 40)}…` : chu;
        const alt = el.getAttribute("alt");
        if (alt) return alt;
        const title = el.getAttribute("title");
        if (title) return title;
        return "(khong co ten kha truy)";
      };

      for (const el of Array.from(document.querySelectorAll<HTMLElement>(vaiTroBam))) {
        // [tabindex] chi la mot NHANH THEM: phan tu da la a/button/input/select/textarea/[role="button"]
        // thi van tinh du co tabindex am (vd nut tam thoi bo khoi thu tu Tab van con bam duoc bang chuot/
        // cham) - chi loai khi phan tu KHONG thuoc vai tro co ban va tabindex cua no am hoac khong hop le.
        if (!el.matches(vaiTroCoBan)) {
          const ti = Number(el.getAttribute("tabindex"));
          if (!Number.isFinite(ti) || ti < 0) continue;
        }
        if (bDisabled(el)) continue;
        // Phan tu trong cay inert khong bam, khong focus duoc (vd trang nam duoi trinh xem bia cua Dau thoi gian): cung
        // nhu nut dang tat, no khong phai mot vung bam. Nguong 44px cua moi vung bam that giu nguyen.
        if (el.closest("[inert]")) continue;
        if (biAn(el)) continue;

        const the = el.tagName.toLowerCase();
        const vaiTro = el.getAttribute("role");
        const nhan = `${the}${vaiTro ? `[role="${vaiTro}"]` : ""} "${tenKhaTruy(el)}"`;

        let vung: Element = el;
        let ghiChu = "";
        if (doThay.has(el)) {
          const thay = doThay.get(el);
          if (!thay) {
            ket.push(`${nhan}: mien tru khong tim thay to tien lam vung bam that`);
            continue;
          }
          vung = thay;
          ghiChu = ` qua vung bam that <${thay.tagName.toLowerCase()} class="${thay.getAttribute("class") ?? ""}">`;
        }

        const r = vung.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        const canhNgan = Math.min(r.width, r.height);
        if (canhNgan < 44) {
          ket.push(
            `${nhan}${ghiChu}: ${Math.round(r.width)}x${Math.round(r.height)}px (canh ngan ${canhNgan.toFixed(1)}px, can >= 44px)`,
          );
        }
      }
      return ket;
    },
    { vaiTroCoBan: VAI_TRO_CO_BAN, vaiTroBam: VAI_TRO_BAM, mienTruTrongTrang: mienTru },
  );
}

/**
 * O ngay cua lich (Lich hoa va lich Dau thoi gian dung chung mot khung): bay cot ngay cong cot nhan lan phai vua be
 * ngang 320 toi 414px, nen o rong khoang 37px o 320 va 39px o 375; o cao tu 100px, va moi ngay doc du trong khung chi
 * tiet ngay duoi (mien tru co ten "o-ngay-lich", spec Lich hoa muc 6.4). Van do: o nao hep hon O_NGAY_MIN la loi.
 */
export const O_NGAY = /^button "[0-9]{1,2} tháng [0-9]{1,2}[.]/;
/** Nguong be ngang cua o ngay: so do that la ~37px o 320 va ~39px o 375; duoi nguong nay la CSS lich da hong. */
export const O_NGAY_MIN = 36;
const canhNgan = (dong: string) => Number(/canh ngan ([0-9.]+)px/.exec(dong)?.[1] ?? "0");

/** Nhu vungBamNho, tru o ngay cua lich chi can canh ngan tu O_NGAY_MIN (mien tru o-ngay-lich). */
export async function vungBamNhoCoLich(page: Page, mienTru: MienTru[] = []): Promise<string[]> {
  return (await vungBamNho(page, mienTru)).filter((dong) => !O_NGAY.test(dong) || canhNgan(dong) < O_NGAY_MIN);
}

/**
 * Di qua cac man chinh - ke sach, man doc, trang Viet tiep, man viet, hai trang Dau thoi gian, cai dat - va chay mot phep
 * do (vungBamNho hoac tranNgang) tren tung man, khang dinh rong ngay tai do voi thong diep neu ten man. Dung de ca hai
 * phep do 11.3 va 11.4 chay tren cung mot buoc duyet.
 *
 * Lay duong tu href THAT thay vi doan ma sach, nen khong phu thuoc cuon nao dang mo:
 * - tam bia va man doc: lien ket cua cuon dau tien tren ke (moi cuon tren ke la mot lien ket toi man doc, ShelfBook.tsx),
 *   mo ra tam bia; bam "Mở sách" thi toi man doc;
 * - trang Viet tiep: nut "Viet tiep" cua cuon sach mo (src/app/ke-sach/page.tsx: nut do chi co khi trang gan nhat la
 *   cuon cua chinh nguoi xem). Man viet la man ma trang do gui toi, cung cuon;
 * - hai trang Dau thoi gian: muc cua thanh dieu huong, roi dong dau tien cua trang chon cuon.
 * Can it nhat mot cuon co trang da dang (dangToThang) cua nguoi dang xem de cuon sach mo xuat hien - mot cong chay tren
 * ke rong la mot cong luon xanh.
 */
export async function doMoiManChinh(page: Page, phepDo: (p: Page) => Promise<string[]>): Promise<void> {
  await page.goto("/ke-sach");
  expect(await phepDo(page), "ke sach").toEqual([]);

  // Lay het href TRUOC khi roi khoi /ke-sach: sau khi dieu huong di, ke sach khong con tren trang nua.
  const docHref = await page.locator(".cuon__lien").first().getAttribute("href");
  const vietTiepHref = await page.getByRole("article", { name: "Một trang trong sách" }).getByRole("link", { name: "Viết tiếp" }).getAttribute("href");
  const dauHref = await page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Dấu thời gian" }).getAttribute("href");
  if (!docHref) {
    throw new Error("doMoiManChinh: khong tim thay cuon nao tren ke sach - can it nhat mot cuon");
  }
  const maSach = /^\/sach\/([^/]+)\/viet-tiep$/.exec(vietTiepHref ?? "")?.[1];
  if (!vietTiepHref || !maSach) {
    throw new Error("doMoiManChinh: khong tim thay lien ket 'Viet tiep' toi /sach/<ma>/viet-tiep tren ke sach - can cuon do la cua chinh nguoi dang xem");
  }
  if (!dauHref) {
    throw new Error("doMoiManChinh: thanh dieu huong khong co muc 'Dau thoi gian'");
  }

  // Cuon tren ke mo qua tam bia (chu du an chot 26/09): do ca tam bia lan man doc sau khi bam "Mở sách".
  await page.goto(docHref);
  expect(await phepDo(page), "tam bia").toEqual([]);
  await moSach(page);
  expect(await phepDo(page), "man doc").toEqual([]);

  await page.goto(vietTiepHref);
  expect(await phepDo(page), "trang viet tiep").toEqual([]);

  await page.goto(`/sach/${maSach}/viet`);
  expect(await phepDo(page), "man viet").toEqual([]);

  await page.goto(dauHref);
  expect(await phepDo(page), "dau thoi gian: trang chon cuon").toEqual([]);
  const cuonHref = await page.locator(".dtg-dong .nhap__ten").first().getAttribute("href");
  if (!cuonHref) {
    throw new Error("doMoiManChinh: trang chon cuon cua Dau thoi gian khong co cuon nao");
  }
  await page.goto(cuonHref);
  expect(await phepDo(page), "dau thoi gian: trang mot cuon").toEqual([]);

  await page.goto("/cai-dat");
  expect(await phepDo(page), "cai dat").toEqual([]);
}

/** Mot man de doMan di qua: ten de doc trong thong diep, duong de mo, va dau hieu da ve xong. */
export type Man = { ten: string; duong: string; daVe: (p: Page) => Promise<unknown> };

/**
 * Mo lai man o tung be rong trong BE_RONG (dat be rong TRUOC khi tai trang, nhu doMoiManChinh, de bo cuc do
 * JS tinh theo be rong cua so khong con dang doi), doi dau hieu da ve, roi do tran ngang o ca bon be rong va
 * vung bam o BE_RONG_CHAM.
 */
export async function doMan(page: Page, man: Man, mienTru: MienTru[] = []): Promise<void> {
  for (const width of BE_RONG) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(man.duong);
    await man.daVe(page);
    if (width === BE_RONG_CHAM) expect(await vungBamNho(page, mienTru), `${man.ten}: vung bam`).toEqual([]);
    expect(await tranNgang(page), `${man.ten} o ${width}px: tran ngang`).toEqual([]);
  }
}
