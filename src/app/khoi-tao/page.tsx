import { redirect } from "next/navigation";
import { connection } from "next/server";
import { db } from "@/server/db";
import { readSeatState, mayCreateNextSeat } from "@/server/identity/accounts";
import { currentAccount } from "@/server/web/cookies";
import { SeatForm } from "./SeatForm";

export default async function KhoiTao() {
  await connection();
  const [state, me] = await Promise.all([readSeatState(db), currentAccount()]);

  // Chi la mot rao chan hien thi: khong cho ai thay mot cai form chac chan se hong.
  // Cua an toan that nam trong actionCreateSeat.
  if (!mayCreateNextSeat(state, me)) redirect("/");

  return <SeatForm luot={state.phase === "trong" ? "mo-dau" : "dap-le"} />;
}
