import { afterEach, describe, it, expect, vi } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { S3_ENV } from "@/lib/media/config";
import { createMediaStore, DEFAULT_LOCAL_DIR, getMediaStore } from "@/server/media/get-store";
import { LocalDiskStore } from "@/server/media/local-disk";
import { S3Store } from "@/server/media/s3";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createMediaStore", () => {
  it("dung dung ban cai theo lua chon; tat thi null", () => {
    const config = { endpoint: "https://tai-khoan.r2.cloudflarestorage.com", region: "auto", bucket: "mqce-media", accessKeyId: "a", secretAccessKey: "b" };
    expect(createMediaStore({ kind: "s3", config })).toBeInstanceOf(S3Store);
    expect(createMediaStore({ kind: "local", dir: "/tam/x" })).toBeInstanceOf(LocalDiskStore);
    expect(createMediaStore({ kind: "tat" })).toBeNull();
    expect(DEFAULT_LOCAL_DIR).toBe(join(tmpdir(), "mqce-media"));
  });
});

describe("getMediaStore", () => {
  it("doc process.env mot lan cho ca tien trinh: doi env sau do khong doi kho", () => {
    for (const name of Object.values(S3_ENV)) vi.stubEnv(name, "");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("MEDIA_LOCAL_DIR", join(tmpdir(), "mqce-media-get-store"));
    const kho = getMediaStore();
    expect(kho).toBeInstanceOf(LocalDiskStore);
    vi.stubEnv("VERCEL", "1");
    expect(getMediaStore()).toBe(kho);
  });
});
