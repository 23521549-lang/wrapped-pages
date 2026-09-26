"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useRef, type RefObject } from "react";
import { loadYoutubeApi, playerVarsDanhSach, YT_HOST, YT_STATE, type YTPlayer } from "./youtubeApi";

/** phat: dang phat hay dang nap de phat. dung: san sang, khong phat. loi: khong nap duoc trinh phat. */
export type TrangThaiMay = "phat" | "dung" | "loi";

/** Dieu khien trinh phat. Moi ham goi thang API khi trinh phat da san sang, dong bo, de cu bam con nguyen kich hoat. */
export type MayPhatDanhSach = {
  /** Nap mot bai vao trinh phat va phat. Trinh phat chua san sang thi nho bai do, san sang la phat. */
  nap: (videoId: string) => void;
  choi: () => void;
  tam: () => void;
  /** Dung han va bo bai dang cho. */
  ngung: () => void;
};

export type KhiMayPhat = {
  doi: (t: TrangThaiMay) => void;
  /** Bai dang phat da het (trinh phat khong lap). */
  ketThuc: () => void;
  /** Bai nay khong phat duoc (bi go, bi chan nhung): danh sach bo qua no. */
  hong: () => void;
};

/** Ten cua iframe cho trinh doc man hinh. */
const TEN_KHUNG = "Nhạc trong ngày";

/**
 * MOT trinh phat YouTube that trong hostRef cho ca danh sach nhac trong ngay cua trang Dau thoi gian (spec bo sung B4
 * ban hai): doi bai bang loadVideoById tren cung trinh phat, khong tao lai. `khoa` null la khong co trinh phat (ngay
 * khong co bai nao phat duoc); doi khoa thi trinh phat cu bi huy va tao moi (noi goi doi khoa de thu nap lai sau loi).
 * `idDau` chi doc luc tao: bai hien san (chua phat) khi trinh phat vua dung xong. Trinh phat thay mot the div tao rieng
 * ben trong host (khong phai nut React), nen React khong bao gio mat dau nut cua minh.
 */
export function useMayPhatDanhSach(
  hostRef: RefObject<HTMLElement | null>,
  khoa: string | null,
  idDau: string | null,
  khi: KhiMayPhat,
): MayPhatDanhSach {
  const may = useRef<YTPlayer | null>(null);
  /** Bai duoc goi nap khi trinh phat chua san sang: san sang la phat bai nay. */
  const cho = useRef<string | null>(null);
  const dau = useRef(idDau);
  useEffect(() => {
    dau.current = idDau;
  }, [idDau]);
  const doi = useEffectEvent(khi.doi);
  const ketThuc = useEffectEvent(khi.ketThuc);
  const hong = useEffectEvent(khi.hong);

  useEffect(() => {
    const host = hostRef.current;
    if (khoa === null || !host) return;
    let goRa = false;
    let player: YTPlayer | null = null;
    loadYoutubeApi()
      .then((yt) => {
        if (goRa) return;
        const moc = document.createElement("div");
        host.append(moc);
        player = new yt.Player(moc, {
          host: YT_HOST,
          videoId: cho.current ?? dau.current ?? "",
          playerVars: playerVarsDanhSach(),
          events: {
            onReady: (e) => {
              if (goRa) return;
              may.current = e.target;
              const id = cho.current;
              cho.current = null;
              if (id === null) doi("dung");
              else e.target.loadVideoById(id);
            },
            onStateChange: (e) => {
              if (goRa) return;
              if (e.data === YT_STATE.ENDED) ketThuc();
              else doi(e.data === YT_STATE.PLAYING || e.data === YT_STATE.BUFFERING ? "phat" : "dung");
            },
            onError: () => {
              if (!goRa) hong();
            },
          },
        });
        const khung = player.getIframe();
        khung.title = TEN_KHUNG;
      })
      // catch sau then: bat ca loi nap API lan loi nem trong buoc tao trinh phat.
      .catch(() => {
        if (!goRa) doi("loi");
      });
    return () => {
      goRa = true;
      may.current = null;
      player?.destroy();
      host.replaceChildren();
    };
  }, [hostRef, khoa]);

  const nap = useCallback((videoId: string) => {
    const m = may.current;
    if (m) m.loadVideoById(videoId);
    else cho.current = videoId;
  }, []);
  const choi = useCallback(() => may.current?.playVideo(), []);
  const tam = useCallback(() => may.current?.pauseVideo(), []);
  const ngung = useCallback(() => {
    cho.current = null;
    may.current?.stopVideo();
  }, []);
  return useMemo(() => ({ nap, choi, tam, ngung }), [nap, choi, tam, ngung]);
}
