import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getServerKey } from "@/server/db";

const SAVED = process.env.SERVER_KEY;

beforeEach(() => {
  delete process.env.SERVER_KEY;
});

afterEach(() => {
  if (SAVED === undefined) delete process.env.SERVER_KEY;
  else process.env.SERVER_KEY = SAVED;
});

describe("getServerKey", () => {
  it("thieu bien moi truong thi nem loi", () => {
    expect(() => getServerKey()).toThrow("thieu SERVER_KEY");
  });

  it("ngan hon 32 ky tu thi nem loi", () => {
    process.env.SERVER_KEY = "qua-ngan";
    expect(() => getServerKey()).toThrow(/it nhat 32 ky tu/);
  });

  it("dung bang chuoi mau trong .env.example thi nem loi", () => {
    process.env.SERVER_KEY = "doi-chuoi-nay-thanh-mot-chuoi-ngau-nhien-dai";
    expect(() => getServerKey()).toThrow(/chuoi mau/);
  });

  it("khoa hop le, du dai va khac chuoi mau, thi tra ve dung gia tri", () => {
    const khoa = "mot-khoa-that-su-ngau-nhien-va-du-dai-32";
    process.env.SERVER_KEY = khoa;
    expect(getServerKey()).toBe(khoa);
  });
});
