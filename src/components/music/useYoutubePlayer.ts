"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { loadYoutubeApi, playerVars, YT_HOST, YT_STATE, type YTPlayer } from "./youtubeApi";

/** tai: API hay trinh phat chua san sang. phat: dang phat hoac dang nap de phat. dung: san sang, khong phat. loi: khong phat duoc. */
export type MusicState = "tai" | "phat" | "dung" | "loi";

/** Ten cua iframe cho trinh doc man hinh. */
const TEN_KHUNG = "Nhạc nền";

function theoMa(ma: number): MusicState {
  return ma === YT_STATE.PLAYING || ma === YT_STATE.BUFFERING ? "phat" : "dung";
}

/**
 * Mot trinh phat YouTube that trong hostRef, tao mot lan cho moi videoId, huy khi go ra. Trinh phat thay mot
 * the div tao rieng ben trong host (khong phai nut React), nen React khong bao gio mat dau nut cua minh.
 * state di theo su kien that cua trinh phat (onReady, onStateChange, onError), khong theo y muon; loi la
 * trang thai cuoi cua mot videoId. Loi nem ra luc tao trinh phat (constructor, getIframe) cung la loi. Doi videoId
 * thi state ve tai ngay trong lan ve do va trinh phat moi duoc tao, khong dua vao key cua noi goi. play va pause goi
 * thang API khi trinh phat da san sang, dong bo, de lan bam cua nguoi dung con nguyen kich hoat; chua san sang thi
 * khong lam gi (khong hen phat sau, vi luc do trinh phat co the da ra khoi man hinh).
 */
export function useYoutubePlayer(
  hostRef: RefObject<HTMLElement | null>,
  videoId: string,
): { state: MusicState; play: () => void; pause: () => void } {
  // state gan voi videoId cua no, roi suy ra: khong can setState trong effect de dat lai khi doi video.
  const [ghi, setGhi] = useState<{ videoId: string; state: MusicState }>({ videoId, state: "tai" });
  const state = ghi.videoId === videoId ? ghi.state : "tai";
  const san = useRef<YTPlayer | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    let goRa = false;
    let player: YTPlayer | null = null;
    const doi = (next: MusicState) => {
      if (!goRa) setGhi((cu) => ({ videoId, state: cu.videoId === videoId && cu.state === "loi" ? "loi" : next }));
    };
    const hong = () => {
      if (!goRa) setGhi({ videoId, state: "loi" });
    };
    loadYoutubeApi()
      .then((yt) => {
        if (goRa) return;
        const moc = document.createElement("div");
        host.append(moc);
        player = new yt.Player(moc, {
          host: YT_HOST,
          videoId,
          playerVars: playerVars(videoId),
          events: {
            onReady: (e) => {
              if (goRa) return;
              san.current = e.target;
              doi("dung");
            },
            onStateChange: (e) => doi(theoMa(e.data)),
            onError: hong,
          },
        });
        const khung = player.getIframe();
        khung.title = TEN_KHUNG;
        khung.tabIndex = -1;
      })
      // catch sau then: bat ca loi nap API lan loi nem trong buoc tao trinh phat, khong de promise bi tu choi treo.
      .catch(hong);
    return () => {
      goRa = true;
      san.current = null;
      player?.destroy();
      host.replaceChildren();
    };
  }, [hostRef, videoId]);

  const play = useCallback(() => san.current?.playVideo(), []);
  const pause = useCallback(() => san.current?.pauseVideo(), []);
  return { state, play, pause };
}
