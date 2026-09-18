import type { SeatState } from "@/server/identity/accounts";

/**
 * Bang dieu huong trang goc. Ham thuan de test het moi truong hop.
 * Da dang nhap ma moi co mot cho ngoi: dua toi /khoi-tao de dat ten cho nguoi mo dau.
 */
export function routeFor(state: SeatState, signedIn: boolean, founderCookie: boolean): string {
  if (signedIn) return state.phase === "mot-nguoi" ? "/khoi-tao" : "/ke-sach";
  if (state.phase === "trong") return "/khoi-tao";
  if (state.phase === "mot-nguoi" && founderCookie) return "/cho";
  return "/dang-nhap";
}
