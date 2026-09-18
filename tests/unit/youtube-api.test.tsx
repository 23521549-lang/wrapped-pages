// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { YTNamespace } from "@/components/music/youtubeApi";

/**
 * Promise nap API la bien cua module. Moi test nap lai module (vi.resetModules roi import dong) nen bat dau khong co
 * promise nao, va afterEach go moi the script con lai: cac test khong phu thuoc thu tu chay.
 */

type YoutubeApi = typeof import("@/components/music/youtubeApi");
let api: YoutubeApi;

const cacThe = () => document.head.querySelectorAll<HTMLScriptElement>(`script[src="${api.YT_API_SRC}"]`);

beforeEach(async () => {
  vi.resetModules();
  api = await import("@/components/music/youtubeApi");
});

afterEach(() => {
  for (const the of cacThe()) the.remove();
  delete window.YT;
  delete window.onYouTubeIframeAPIReady;
});

describe("loadYoutubeApi", () => {
  it("script loi: tu choi, go the script, tra lai ham cu; lan goi sau nap lai tu dau", async () => {
    const cu = vi.fn();
    window.onYouTubeIframeAPIReady = cu;
    const p = api.loadYoutubeApi();
    expect(cacThe()).toHaveLength(1);
    cacThe()[0].dispatchEvent(new Event("error"));
    await expect(p).rejects.toThrow("khong nap duoc YouTube IFrame API");
    expect(cacThe()).toHaveLength(0);
    expect(window.onYouTubeIframeAPIReady).toBe(cu);

    const lai = api.loadYoutubeApi();
    expect(lai).not.toBe(p);
    expect(cacThe()).toHaveLength(1);
    cacThe()[0].dispatchEvent(new Event("error"));
    await expect(lai).rejects.toThrow("khong nap duoc YouTube IFrame API");
    expect(cu).not.toHaveBeenCalled();
  });

  it("nap mot lan: cac lan goi chung mot promise va mot the script; API san sang thi goi ca ham co tu truoc", async () => {
    const cu = vi.fn();
    window.onYouTubeIframeAPIReady = cu;
    const p = api.loadYoutubeApi();
    expect(api.loadYoutubeApi()).toBe(p);
    expect(cacThe()).toHaveLength(1);

    const yt = { Player: vi.fn() } as unknown as YTNamespace;
    window.YT = yt;
    window.onYouTubeIframeAPIReady?.();
    await expect(p).resolves.toBe(yt);
    expect(cu).toHaveBeenCalledTimes(1);
    expect(api.loadYoutubeApi()).toBe(p);
    expect(cacThe()).toHaveLength(1);
  });

  it("API bao san sang ma thieu YT.Player: tu choi, go the script, tra lai ham cu; lan goi sau chen lai script", async () => {
    const cu = vi.fn();
    window.onYouTubeIframeAPIReady = cu;
    const p = api.loadYoutubeApi();
    const theDau = cacThe()[0];
    window.YT = {} as unknown as YTNamespace;
    window.onYouTubeIframeAPIReady?.();
    await expect(p).rejects.toThrow("YouTube IFrame API bao san sang ma chua co YT.Player");
    expect(cu).toHaveBeenCalledTimes(1);
    expect(cacThe()).toHaveLength(0);
    expect(window.onYouTubeIframeAPIReady).toBe(cu);

    delete window.YT;
    const lai = api.loadYoutubeApi();
    expect(lai).not.toBe(p);
    expect(cacThe()).toHaveLength(1);
    expect(cacThe()[0]).not.toBe(theDau);
  });
});
