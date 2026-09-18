import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { readSeatState } from "@/server/identity/accounts";
import { currentAccount, FOUNDER_COOKIE } from "@/server/web/cookies";
import { routeFor } from "@/server/web/route";

export default async function Home() {
  await connection();
  const [me, state, jar] = await Promise.all([currentAccount(), readSeatState(db), cookies()]);
  redirect(routeFor(state, me !== null, Boolean(jar.get(FOUNDER_COOKIE)?.value)));
}
