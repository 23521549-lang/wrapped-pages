import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";

/*
 * Moi khoi CSS (mot bo chon chi gom dung mot lop, vd `.moc{`) chi duoc dinh nghia trong MOT tep. Hai thanh phan khong
 * lien quan dat trung mot ten lop thi luat cua tep nay de len phan tu cua tep kia, lang le va chi lo ra tren man that:
 * dong thoi gian cua man Sua sach tung dat ten khoi `.o`, trung voi o chon troi cua hop Tha tam trang, nen `.o input`
 * cua hop tam trang thu moi o radio chon bia thanh 1x1px, con khung luoi ba cot cua dong thoi gian keo lech hop tam trang.
 *
 * Bo chon co ngu canh (`.xem-truoc .bia-cho`, `.khung-to > .to-giay`) la chu y ghi de mot khoi o tep khac, nen khong tinh.
 */

const THU_MUC = "src/styles";

/** Moi bo chon chi gom dung mot lop, kem ten tep dinh nghia no. Bo chu thich truoc de chu trong chu thich khong bi dem. */
function khoiTrongTep(tep: string): string[] {
  const css = readFileSync(`${THU_MUC}/${tep}`, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return [...css.matchAll(/([^{}@;]+)\{/g)]
    .flatMap((m) => m[1].split(","))
    .map((chon) => chon.trim())
    .filter((chon) => /^\.[a-zA-Z][\w-]*$/.test(chon));
}

describe("khoi CSS", () => {
  it("moi khoi chi duoc dinh nghia trong mot tep", () => {
    const noi = new Map<string, Set<string>>();
    for (const tep of readdirSync(THU_MUC).filter((t) => t.endsWith(".css"))) {
      for (const khoi of khoiTrongTep(tep)) noi.set(khoi, (noi.get(khoi) ?? new Set()).add(tep));
    }
    const trung = [...noi].filter(([, tep]) => tep.size > 1).map(([khoi, tep]) => `${khoi}: ${[...tep].sort().join(", ")}`);
    expect(trung).toEqual([]);
  });

  it("phep doc bat duoc dung kieu trung ten tung xay ra", () => {
    // Doc ca hai tep that: phep loc bo chon khong duoc lang le bo sot khoi cua tep nao.
    expect(khoiTrongTep("tam-trang.css")).toContain(".o");
    expect(khoiTrongTep("app.css")).toContain(".moc");
    expect(khoiTrongTep("app.css")).not.toContain(".o");
  });
});
