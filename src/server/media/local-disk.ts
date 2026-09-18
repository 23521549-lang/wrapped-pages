import { mkdir, open, rm, writeFile, type FileHandle } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assertStoreKey, type ByteRange, type MediaStore } from "./store";

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/**
 * Doc tron khoang [start, end] roi dong handle ngay, tra ve stream tu bo nho. Khong giu handle song theo stream: stream
 * co the khong bao gio duoc doc het hay huy (yeu cau HEAD, nguoi dung dong trang giua chung), luc do handle chi duoc
 * dong khi bi thu gom rac va Node canh bao DEP0137. Moi tep media toi da vai MB (MEDIA_MAX_BYTES) nen doc mot lan la vua.
 */
async function docKhoang(handle: FileHandle, range: ByteRange): Promise<ReadableStream<Uint8Array>> {
  const length = Math.max(range.end + 1 - range.start, 0);
  const { bytesRead, buffer } = await handle.read(new Uint8Array(length), 0, length, range.start);
  const bytes = buffer.subarray(0, bytesRead);
  return new ReadableStream<Uint8Array>({
    start(controller) {
      if (bytes.length > 0) controller.enqueue(bytes);
      controller.close();
    },
  });
}

/**
 * Kho tren dia cho dev va e2e: moi object la mot tep o dir/{tien to}/{id}.{duoi}. Key da qua STORE_KEY nen
 * khong the tro ra ngoai dir. Action va route handler co the nam o hai bundle, nen kho doc ghi dia chu khong giu
 * Map trong module.
 */
export class LocalDiskStore implements MediaStore {
  readonly #dir: string;

  constructor(dir: string) {
    this.#dir = dir;
  }

  #path(key: string): string {
    assertStoreKey(key);
    return join(this.#dir, ...key.split("/"));
  }

  async put(key: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
    const path = this.#path(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }

  async get(key: string, range: ByteRange | null): Promise<ReadableStream<Uint8Array> | null> {
    const path = this.#path(key);
    const handle = await open(path, "r").catch((error: unknown) => {
      if (isMissing(error)) return null;
      throw error;
    });
    if (!handle) return null;
    try {
      const { size } = await handle.stat();
      return await docKhoang(handle, range ?? { start: 0, end: size - 1 });
    } finally {
      await handle.close();
    }
  }

  async remove(keys: readonly string[]): Promise<void> {
    const paths = keys.map((key) => this.#path(key));
    await Promise.all(paths.map((path) => rm(path, { force: true })));
  }
}
