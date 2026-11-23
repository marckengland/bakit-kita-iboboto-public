export class RequestBodyError extends Error {
  constructor(readonly status: 400 | 408 | 413 | 415) {
    super("Invalid request body");
  }
}

/** Bound bytes while reading, including requests without Content-Length. */
export async function readBoundedJson(request: Request, maxBytes: number): Promise<unknown> {
  if (
    request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json"
  ) {
    throw new RequestBodyError(415);
  }
  const length = request.headers.get("content-length");
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) {
    throw new RequestBodyError(400);
  }
  if (length !== null && Number(length) > maxBytes) {
    throw new RequestBodyError(413);
  }
  if (!request.body) {
    throw new RequestBodyError(400);
  }
  const reader = request.body.getReader();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let expired = false;
  const deadline = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => {
      expired = true;
      reject(new RequestBodyError(408));
      void reader.cancel().catch(() => undefined);
    }, 5000);
  });
  const read = async () => {
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (expired) {
          throw new RequestBodyError(408);
        }
        if (done) {
          break;
        }
        bytes += value.byteLength;
        if (bytes > maxBytes) {
          void reader.cancel().catch(() => undefined);
          throw new RequestBodyError(413);
        }
        chunks.push(value);
      }
      try {
        return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
      } catch {
        throw new RequestBodyError(400);
      }
    } finally {
      reader.releaseLock();
    }
  };
  try {
    return await Promise.race([read(), deadline]);
  } finally {
    clearTimeout(timer);
  }
}
