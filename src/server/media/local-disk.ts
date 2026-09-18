import { mkdir, open, rm, writeFile, type FileHandle } from "node:fs/promises";
import { dirname, join } from "node:path";
import { assertStoreKey, type ByteRange, type MediaStore } from "./store";

/** Moi lan doc tu dia toi da chung nay byte. */
const CHUNK_BYTES = 64 * 1024;

function isMissing(error: unknown): boolean {
  return error instanceof Error && "code" in error && error.code === "ENOENT";
}

/** Stream doc khoang [start, end] qua file handle theo tung khuc; dong handle khi het, khi loi hoac khi bi huy. */
function fileStream(handle: FileHandle, range: ByteRange): ReadableStream<Uint8Array> {
  let position = range.start;
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const length = Math.min(CHUNK_BYTES, range.end + 1 - position);
        const { bytesRead, buffer } = await handle.read(new Uint8Array(Math.max(length, 0)), 0, Math.max(length, 0), position);
        if (bytesRead === 0) {
          await handle.close();
          controller.close();
          return;
        }
        position += bytesRead;
        controller.enqueue(buffer.subarray(0, bytesRead));
      } catch (error) {
        await handle.close();
        throw error;
      }
    },
    cancel: () => handle.close(),
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
      return fileStream(handle, range ?? { start: 0, end: size - 1 });
    } catch (error) {
      await handle.close();
      throw error;
    }
  }

  async remove(keys: readonly string[]): Promise<void> {
    const paths = keys.map((key) => this.#path(key));
    await Promise.all(paths.map((path) => rm(path, { force: true })));
  }
}
