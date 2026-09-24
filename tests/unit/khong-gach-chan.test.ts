import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { boComment, THU_MUC_CSS } from "../helpers/bang-token";

/*
 * Chu du an chot hai lan (yeu cau dot ba, diem 2 va diem 19): khong gach chan chu o BAT KY dau trong giao dien. Bai
 * nay doc thang CSS that chu khong doc mot danh sach viet tay, nen khong ai them lai duoc mot gach chan moi ma khong
 * bi bat. `text-decoration-color`, `-thickness`, `-offset` khong khop vi bo chon doi dau hai cham ngay sau ten thuoc
 * tinh; `text-decoration: none` cua globals.css cung khong khop vi gia tri khong chua "underline".
 *
 * Chi soat CSS cua giao dien. Gach chan ma chinh nguoi dung go trong bai viet (dau U cua thanh cong cu, the <u>) la
 * noi dung chu khong phai kieu cua web, nen no khong nam trong thu muc nay va khong bi cam.
 */
describe("khong con gach chan trong CSS", () => {
  it("khong tep css nao khai gach chan", () => {
    const tep = readdirSync(THU_MUC_CSS).filter((ten) => ten.endsWith(".css"));
    // Neu duong dan hong thi vong lap chay tren danh sach rong va bai kiem "dat" gia. Chan truoc kha nang do.
    expect(tep.length).toBeGreaterThan(0);

    const sai: string[] = [];
    for (const ten of tep) {
      const css = boComment(readFileSync(`${THU_MUC_CSS}/${ten}`, "utf8"));
      for (const m of css.matchAll(/text-decoration(?:-line)?\s*:\s*([^;}]+)/g)) {
        if (m[1].includes("underline")) sai.push(`${ten}: ${m[0].trim()}`);
      }
    }
    expect(sai).toEqual([]);
  });
});
