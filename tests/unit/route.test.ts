import { describe, it, expect } from "vitest";
import { routeFor } from "@/server/web/route";

const trong = { phase: "trong" } as const;
const mot = { phase: "mot-nguoi", takenSeat: 1 } as const;
const du = { phase: "du-hai" } as const;

describe("routeFor", () => {
  it("web trong thi nguoi mo dau di dat ten", () => expect(routeFor(trong, false, false)).toBe("/khoi-tao"));
  it("mot cho, nguoi mo dau chua dang nhap duoc thi di man cho", () => expect(routeFor(mot, false, true)).toBe("/cho"));
  it("mot cho, nguoi la hoac nguoi thu hai chua dang nhap thi di dang nhap", () => expect(routeFor(mot, false, false)).toBe("/dang-nhap"));
  it("mot cho, nguoi thu hai da dang nhap thi di dat ten dap le", () => expect(routeFor(mot, true, false)).toBe("/khoi-tao"));
  it("du hai, da dang nhap thi vao ke sach", () => expect(routeFor(du, true, false)).toBe("/ke-sach"));
  it("du hai, chua dang nhap thi di dang nhap", () => expect(routeFor(du, false, false)).toBe("/dang-nhap"));
  it("du hai, cookie nguoi mo dau khong con tac dung", () => expect(routeFor(du, false, true)).toBe("/dang-nhap"));
});
