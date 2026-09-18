/** Ma video YouTube: dung 11 ky tu chu, so, gach duoi, gach ngang. CHECK books_youtube_id dung dung mau nay (co test). */
export const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** Link dai hon muc nay thi khong nhan, ke ca khi trong do co mot ma video dung. */
export const YOUTUBE_LINK_MAX = 300;

export const YOUTUBE_LINK_ERROR = "Link YouTube chưa đúng.";

export type YoutubeLink = { ok: true; id: string | null } | { ok: false; error: string };

/** Host nhan duong dan /watch?v=, /shorts/ID, /embed/ID, /live/ID. */
const VIDEO_HOSTS = new Set([
  "youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com",
  "youtube-nocookie.com", "www.youtube-nocookie.com",
]);
const SHORT_HOST = "youtu.be";
const ID_PATHS = new Set(["shorts", "embed", "live"]);

/** Ma video nam trong duong dan va tham so cua mot link da qua kiem scheme va host; null khi sai dang. */
function idInPath(url: URL): string | null {
  const parts = url.pathname.split("/").slice(1);
  if (url.hostname === SHORT_HOST) return parts.length === 1 ? parts[0] : null;
  if (parts.length === 1 && parts[0] === "watch") {
    const v = url.searchParams.getAll("v");
    return v.length === 1 ? v[0] : null;
  }
  return parts.length === 2 && ID_PATHS.has(parts[0]) ? parts[1] : null;
}

function parseUrl(link: string): URL | null {
  try {
    return new URL(link);
  } catch {
    return null;
  }
}

/**
 * Doc link nhac nen o form sach. Chuoi rong la khong co nhac. Chi nhan link http hoac https toi dung
 * host cua YouTube, khong kem ten dang nhap hay cong, va chi giu lai ma video da chuan hoa: ma tran khong
 * phai link nen khong nhan.
 */
export function parseYoutubeLink(raw: string): YoutubeLink {
  const link = raw.trim();
  if (link === "") return { ok: true, id: null };
  const url = link.length <= YOUTUBE_LINK_MAX ? parseUrl(link) : null;
  const valid = url !== null
    && (url.protocol === "https:" || url.protocol === "http:")
    && url.username === "" && url.password === "" && url.port === ""
    && (url.hostname === SHORT_HOST || VIDEO_HOSTS.has(url.hostname));
  const id = valid ? idInPath(url) : null;
  return id !== null && YOUTUBE_ID.test(id) ? { ok: true, id } : { ok: false, error: YOUTUBE_LINK_ERROR };
}

/** Link ngan cua mot ma video, dung de dien lai o form sua sach. */
export function youtubeLink(id: string): string {
  return `https://youtu.be/${id}`;
}
