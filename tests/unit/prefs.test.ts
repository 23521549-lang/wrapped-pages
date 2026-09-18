import { describe, it, expect } from "vitest";
import { seedHai } from "../helpers/seed";
import { readMusicMuted, setMusicMuted } from "@/server/identity/prefs";

describe("tat nhac nen theo tung nguoi", () => {
  it("mac dinh ca hai nguoi deu chua tat", async () => {
    const { db, seat1, seat2 } = await seedHai();
    expect(await readMusicMuted(db, seat1.id)).toBe(false);
    expect(await readMusicMuted(db, seat2.id)).toBe(false);
  });

  it("tat va bat lai chi doi lua chon cua chinh nguoi do", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await setMusicMuted(db, seat1.id, true);
    expect(await readMusicMuted(db, seat1.id)).toBe(true);
    expect(await readMusicMuted(db, seat2.id)).toBe(false);
    await setMusicMuted(db, seat1.id, false);
    expect(await readMusicMuted(db, seat1.id)).toBe(false);
  });

  it("tai khoan khong ton tai thi doc la chua tat, ghi khong cham ai", async () => {
    const { db, seat1, seat2 } = await seedHai();
    const la = "0b8f3c2e-4d1a-4f6b-9c3d-2e1f0a9b8c7d";
    await setMusicMuted(db, la, true);
    expect(await readMusicMuted(db, la)).toBe(false);
    expect(await readMusicMuted(db, seat1.id)).toBe(false);
    expect(await readMusicMuted(db, seat2.id)).toBe(false);
  });
});
