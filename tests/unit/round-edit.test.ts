import { describe, expect, it } from "vitest";
import {
  readRoundEditTemp, ROUND_EDIT_PREFIX, ROUND_EDIT_TEMP_MAX_MS, roundEditKey, roundEditTemp, staleRoundTempKeys,
} from "@/components/editor/roundEdit";
import type { DocJson } from "@/lib/doc/types";

const LUOT = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";
const MOC = "2026-09-18T07:05:00.000Z";
const NOW = 1_800_000_000_000;

const doan = (text: string) => ({ type: "paragraph" as const, content: [{ type: "text" as const, text }] });
const CHU: DocJson = { type: "doc", content: [doan("Sáng nay trời mưa.")] };

describe("ban tam cua man sua luot", () => {
  it("khoa theo ma luot", () => {
    expect(roundEditKey(LUOT)).toBe(`${ROUND_EDIT_PREFIX}${LUOT}`);
  });

  it("doc lai dung tai lieu khi cung moc phien ban; khac moc, hong JSON, tai lieu sai deu null", () => {
    const raw = roundEditTemp(MOC, CHU, NOW);
    expect(readRoundEditTemp(raw, MOC)).toEqual(CHU);
    expect(readRoundEditTemp(raw, "2026-09-19T00:00:00.000Z")).toBeNull();
    expect(readRoundEditTemp(null, MOC)).toBeNull();
    expect(readRoundEditTemp("{hong", MOC)).toBeNull();
    expect(readRoundEditTemp(JSON.stringify({ version: MOC, doc: { type: "doc", content: [{ type: "heading" }] }, at: NOW }), MOC)).toBeNull();
  });

  it("don ban tam: luot khac qua 24 gio hay hong thi xoa, ban tam cua man sua mot to cu luon xoa, cua chinh luot nay va khoa khac giu", () => {
    const khoa = roundEditKey(LUOT);
    const cu = roundEditKey("11111111-2222-4333-8444-555555555555");
    const moi = roundEditKey("66666666-7777-4888-8999-000000000000");
    const hong = roundEditKey("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    const entries: [string, string | null][] = [
      [khoa, roundEditTemp(MOC, CHU, NOW - ROUND_EDIT_TEMP_MAX_MS - 5)],
      [cu, roundEditTemp(MOC, CHU, NOW - ROUND_EDIT_TEMP_MAX_MS - 1)],
      [moi, roundEditTemp(MOC, CHU, NOW - 1000)],
      [hong, "khong phai JSON"],
      ["mqce-sua-trang-5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a-3", roundEditTemp(MOC, CHU, NOW)],
      ["mqce-tap-trung", "tat"],
    ];
    expect(staleRoundTempKeys(entries, khoa, NOW).sort()).toEqual([cu, hong, "mqce-sua-trang-5d1c7a9e-2b4f-4c6d-8e0a-1f3b5d7c9e2a-3"].sort());
  });
});

