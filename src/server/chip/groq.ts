/*
 * Goi dich vu AI cua Chip (5e, spec A, E): Groq, giao dien chat completions kieu OpenAI, goi tu may chu nen CSP khong doi.
 * Mo hinh chinh openai/gpt-oss-120b; het han muc (429) thi thu openai/gpt-oss-20b (han muc rieng). Chia khoa o
 * GROQ_API_KEY (chi may chu). GROQ_BASE_URL chi dat trong kiem thu (tests/e2e/env.ts) de tro toi may chu gia.
 */

export const MO_HINH = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"] as const;
const GOC_MAC_DINH = "https://api.groq.com/openai/v1";
/** Tran token cau tra loi (gom ca phan suy nghi ngan cua gpt-oss). */
const TRA_LOI_TOI_DA = 700;
const HET_GIO_MS = 25_000;

export type TinGoi = { role: "system" | "user" | "assistant"; content: string };

/**
 * "ok": co cau tra loi. "het": ca hai mo hinh het han muc; retryAfterGiay la so giay dich vu bao (null neu khong bao).
 * "loi": loi khac (mang, may chu, tra ve la). "chua-co-khoa": chua dat GROQ_API_KEY.
 */
export type KetQuaGoi =
  | { kieu: "ok"; noiDung: string }
  | { kieu: "het"; retryAfterGiay: number | null }
  | { kieu: "loi" }
  | { kieu: "chua-co-khoa" };

export type MoiTruongGoi = { khoa: string | undefined; goc: string | undefined; fetch: typeof fetch };

/** Moi truong that: bien moi truong cua tien trinh va fetch cua Node. */
export const moiTruongThat = (): MoiTruongGoi => ({
  khoa: process.env.GROQ_API_KEY?.trim() || undefined,
  goc: process.env.GROQ_BASE_URL?.trim() || undefined,
  fetch: globalThis.fetch,
});

function docRetryAfter(h: Headers): number | null {
  const v = h.get("retry-after");
  if (v === null) return null;
  const so = Number(v);
  if (Number.isFinite(so) && so >= 0) return so;
  const luc = Date.parse(v);
  return Number.isNaN(luc) ? null : Math.max(0, (luc - Date.now()) / 1000);
}

/** Goi mot mo hinh; 429 tra "het" kem retry-after, loi khac tra "loi". */
async function goiMot(mt: MoiTruongGoi & { khoa: string }, moHinh: string, tin: TinGoi[]): Promise<KetQuaGoi> {
  const hen = new AbortController();
  const t = setTimeout(() => hen.abort(), HET_GIO_MS);
  try {
    const r = await mt.fetch(`${mt.goc ?? GOC_MAC_DINH}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${mt.khoa}` },
      body: JSON.stringify({
        model: moHinh,
        messages: tin,
        temperature: 0.8,
        max_completion_tokens: TRA_LOI_TOI_DA,
        reasoning_effort: "low",
        include_reasoning: false,
      }),
      signal: hen.signal,
    });
    if (r.status === 429) return { kieu: "het", retryAfterGiay: docRetryAfter(r.headers) };
    if (!r.ok) return { kieu: "loi" };
    const j = (await r.json()) as { choices?: { message?: { content?: unknown } }[] };
    const noiDung = j.choices?.[0]?.message?.content;
    return typeof noiDung === "string" && noiDung.trim() !== "" ? { kieu: "ok", noiDung } : { kieu: "loi" };
  } catch {
    return { kieu: "loi" };
  } finally {
    clearTimeout(t);
  }
}

/**
 * Hoi Chip: thu mo hinh chinh, het han muc thi mo hinh phu. Ca hai het thi "het" voi retry-after som hon cua hai (luc it
 * nhat mot mo hinh hoi lai); khong mo hinh nao bao thi null. Loi khac o mo hinh chinh thi khong thu tiep.
 */
export async function goiGroq(tin: TinGoi[], mt: MoiTruongGoi = moiTruongThat()): Promise<KetQuaGoi> {
  const khoa = mt.khoa;
  if (khoa === undefined) return { kieu: "chua-co-khoa" };
  const cho: (number | null)[] = [];
  for (const moHinh of MO_HINH) {
    // oxlint-disable-next-line no-await-in-loop -- co y goi lan luot: chi thu mo hinh phu khi mo hinh chinh het han muc.
    const kq = await goiMot({ ...mt, khoa }, moHinh, tin);
    if (kq.kieu !== "het") return kq;
    cho.push(kq.retryAfterGiay);
  }
  const biet = cho.filter((x): x is number => x !== null);
  return { kieu: "het", retryAfterGiay: biet.length > 0 ? Math.min(...biet) : null };
}
