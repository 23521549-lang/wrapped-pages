import { isUuid } from "@/lib/uuid";
import { PEAK_COUNT, PEAK_MAX } from "./kinds";

/** Thuoc tinh cua khoi anh: id dong media, kich thuoc that tinh bang diem anh. May chu ghi de tu bang media. */
export type ImageAttrs = { id: string; w: number; h: number };
/** Thuoc tinh cua khoi ghi am: id dong media, thoi luong ms va PEAK_COUNT cot song am. May chu ghi de tu bang media. */
export type AudioAttrs = { id: string; ms: number; peaks: number[] };

export type ImageNode = { type: "anh"; attrs: ImageAttrs };
export type AudioNode = { type: "ghi-am"; attrs: AudioAttrs };
/** Khoi media chi nam o cap cao nhat cua tai lieu va la khoi nguyen: khong bao gio bi cat giua hai to. */
export type MediaNode = ImageNode | AudioNode;
export type MediaNodeType = MediaNode["type"];

export const MEDIA_NODE_TYPES = ["anh", "ghi-am"] as const satisfies readonly MediaNodeType[];

export function isMediaNodeType(type: string): type is MediaNodeType {
  return (MEDIA_NODE_TYPES as readonly string[]).includes(type);
}

/** Song am dung hinh: dung PEAK_COUNT cot, moi cot la so nguyen tu 0 toi PEAK_MAX. */
export function isPeaks(value: unknown): value is number[] {
  return Array.isArray(value) && value.length === PEAK_COUNT && value.every((peak) => Number.isInteger(peak) && peak >= 0 && peak <= PEAK_MAX);
}

/** Duong dan duy nhat de trinh duyet doc mot tep media: route /m cua chinh web, kiem quyen o moi lan tai. */
export function mediaSrc(id: string): string {
  return `/m/${id}`;
}

/** Id cua mot khoi media nhu trinh duyet gui len; null khi thieu attrs hoac id khong phai uuid. */
export function mediaNodeId(block: object): string | null {
  if (!("attrs" in block) || typeof block.attrs !== "object" || block.attrs === null || !("id" in block.attrs)) return null;
  return isUuid(block.attrs.id) ? block.attrs.id : null;
}
