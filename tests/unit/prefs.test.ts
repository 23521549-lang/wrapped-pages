import { describe, it, expect } from "vitest";
import { seedHai } from "../helpers/seed";
import { readMusicMuted, setAnHoatDong, setMusicMuted } from "@/server/identity/prefs";
import { loadMe } from "@/server/identity/me";
import type { TestDb } from "../helpers/db";

/** Co an hoat dong doc qua loadMe: khong co ham doc rieng, co nay di kem Me (xem me.ts). */
const an = async (db: TestDb, id: string) => (await loadMe(db, id))?.anHoatDong ?? false;

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

describe("an hoat dong theo tung nguoi", () => {
  it("mac dinh ca hai nguoi deu chua an", async () => {
    const { db, seat1, seat2 } = await seedHai();
    expect(await an(db, seat1.id)).toBe(false);
    expect(await an(db, seat2.id)).toBe(false);
  });

  it("an va bo an chi doi lua chon cua chinh nguoi do", async () => {
    const { db, seat1, seat2 } = await seedHai();
    await setAnHoatDong(db, seat1.id, true);
    expect(await an(db, seat1.id)).toBe(true);
    expect(await an(db, seat2.id)).toBe(false);
    await setAnHoatDong(db, seat1.id, false);
    expect(await an(db, seat1.id)).toBe(false);
  });

  it("hai lua chon cua cung mot nguoi khong lan vao nhau", async () => {
    const { db, seat1 } = await seedHai();
    await setAnHoatDong(db, seat1.id, true);
    expect(await readMusicMuted(db, seat1.id)).toBe(false);
    await setMusicMuted(db, seat1.id, true);
    expect(await an(db, seat1.id)).toBe(true);
  });

  it("tai khoan khong ton tai thi doc la chua an, ghi khong cham ai", async () => {
    const { db, seat1, seat2 } = await seedHai();
    const la = "0b8f3c2e-4d1a-4f6b-9c3d-2e1f0a9b8c7d";
    await setAnHoatDong(db, la, true);
    expect(await an(db, la)).toBe(false);
    expect(await an(db, seat1.id)).toBe(false);
    expect(await an(db, seat2.id)).toBe(false);
  });
});
