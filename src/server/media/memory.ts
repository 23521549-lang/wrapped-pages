import { assertStoreKey, type ByteRange, type MediaStore } from "./store";

function streamOf(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

/** Kho trong bo nho tien trinh, cho unit test. Giu ban sao cua byte, nen sua mang goc sau khi put khong doi object. */
export class MemoryStore implements MediaStore {
  readonly #objects = new Map<string, Uint8Array<ArrayBuffer>>();

  async put(key: string, bytes: Uint8Array<ArrayBuffer>): Promise<void> {
    assertStoreKey(key);
    this.#objects.set(key, bytes.slice());
  }

  async get(key: string, range: ByteRange | null): Promise<ReadableStream<Uint8Array> | null> {
    assertStoreKey(key);
    const bytes = this.#objects.get(key);
    if (!bytes) return null;
    return streamOf(range ? bytes.slice(range.start, range.end + 1) : bytes.slice());
  }

  async remove(keys: readonly string[]): Promise<void> {
    for (const key of keys) assertStoreKey(key);
    for (const key of keys) this.#objects.delete(key);
  }
}
