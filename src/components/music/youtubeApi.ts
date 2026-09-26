/*
 * Nap YouTube IFrame Player API mot lan cho ca tai lieu, va kieu toi thieu cua phan API ma man doc dung.
 * Khong them dependency: chi khai bao dung nhung gi useYoutubePlayer cham toi.
 */

export const YT_API_SRC = "https://www.youtube.com/iframe_api";

/** Trinh phat nhung tu mien nocookie. */
export const YT_HOST = "https://www.youtube-nocookie.com";

/** Ma trang thai cua onStateChange ma web phan biet; moi ma khac la khong phat. ENDED chi den khi trinh phat khong lap. */
export const YT_STATE = { ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3 } as const;

export type YTPlayer = {
  playVideo(): void;
  pauseVideo(): void;
  /** Nap mot video khac vao CUNG trinh phat va phat ngay: danh sach nhac trong ngay cua trang Dau thoi gian. */
  loadVideoById(videoId: string): void;
  stopVideo(): void;
  destroy(): void;
  getIframe(): HTMLIFrameElement;
};

export type YTPlayerEvent = { target: YTPlayer };
export type YTDataEvent = YTPlayerEvent & { data: number };

export type YTPlayerVars = { controls: 0 | 1; autoplay: 0; loop: 0 | 1; playlist?: string; rel: 0; playsinline: 1 };

export type YTPlayerOptions = {
  host: string;
  videoId: string;
  playerVars: YTPlayerVars;
  events: {
    onReady: (e: YTPlayerEvent) => void;
    onStateChange: (e: YTDataEvent) => void;
    onError: (e: YTDataEvent) => void;
  };
};

export type YTNamespace = { Player: new (el: HTMLElement, options: YTPlayerOptions) => YTPlayer };

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

/**
 * Tham so trinh phat: an nut dieu khien cua YouTube vi nut la cua minh, khong tu phat, lap mot
 * video bang playlist chi co chinh no, khong goi y video kenh khac, phat tai cho tren iOS.
 */
export function playerVars(videoId: string): YTPlayerVars {
  return { controls: 0, autoplay: 0, loop: 1, playlist: videoId, rel: 0, playsinline: 1 };
}

/**
 * Tham so trinh phat cua nhac trong ngay (trang Dau thoi gian): hien nut dieu khien cua YouTube (tua, am luong) canh
 * nut cua minh, KHONG lap de het bai bao ENDED va danh sach sang bai ke, khong tu phat, phat tai cho tren iOS.
 */
export function playerVarsDanhSach(): YTPlayerVars {
  return { controls: 1, autoplay: 0, loop: 0, rel: 0, playsinline: 1 };
}

let dangNap: Promise<YTNamespace> | null = null;

/**
 * Promise dung chung cua API cho ca tai lieu. Chen the script dung mot lan; API da san thi tra ngay. Giu ham
 * onYouTubeIframeAPIReady co tu truoc va goi no truoc. Script loi, hay API bao san sang ma thieu YT.Player, thi tu
 * choi, go the script, tra lai ham cu va bo promise da hong, de lan mo sach sau nap lai thay vi hong mai toi khi tai
 * lai trang.
 */
export function loadYoutubeApi(): Promise<YTNamespace> {
  dangNap ??= new Promise<YTNamespace>((xong, hong) => {
    const san = window.YT;
    if (san?.Player) {
      xong(san);
      return;
    }
    const truoc = window.onYouTubeIframeAPIReady;
    const the = document.createElement("script");
    const thatBai = (loi: string) => {
      the.remove();
      window.onYouTubeIframeAPIReady = truoc;
      dangNap = null;
      hong(new Error(loi));
    };
    window.onYouTubeIframeAPIReady = () => {
      truoc?.();
      const yt = window.YT;
      if (yt?.Player) xong(yt);
      else thatBai("YouTube IFrame API bao san sang ma chua co YT.Player");
    };
    the.src = YT_API_SRC;
    the.async = true;
    the.addEventListener("error", () => thatBai("khong nap duoc YouTube IFrame API"), { once: true });
    document.head.append(the);
  });
  return dangNap;
}
