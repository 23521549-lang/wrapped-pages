import { tmpdir } from "node:os";
import { join } from "node:path";
import { selectMediaStore, type MediaStoreChoice } from "@/lib/media/config";
import { LocalDiskStore } from "./local-disk";
import { S3Store } from "./s3";
import type { MediaStore } from "./store";

/** Thu muc cua kho dia cuc bo khi khong dat MEDIA_LOCAL_DIR. */
export const DEFAULT_LOCAL_DIR = join(tmpdir(), "mqce-media");

/** Dung kho theo lua chon da tinh; null la media tat. */
export function createMediaStore(choice: MediaStoreChoice): MediaStore | null {
  switch (choice.kind) {
    case "s3":
      return new S3Store(choice.config);
    case "local":
      return new LocalDiskStore(choice.dir);
    case "tat":
      return null;
  }
}

let current: { store: MediaStore | null } | undefined;

/**
 * Kho tep cua tien trinh, chon mot lan tu process.env qua selectMediaStore. null la media tat. Cau hinh hong
 * thi nem loi chi neu ten bien. Day la noi duy nhat cua mo dun media doc bien moi truong; khong bao gio in gia tri.
 */
export function getMediaStore(): MediaStore | null {
  current ??= { store: createMediaStore(selectMediaStore(process.env, DEFAULT_LOCAL_DIR)) };
  return current.store;
}
