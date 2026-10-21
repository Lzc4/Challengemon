async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([data as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export const gzip = (data: Uint8Array) => pipe(data, new CompressionStream("gzip"));
export const gunzip = (data: Uint8Array) => pipe(data, new DecompressionStream("gzip"));

// fuer grosse dateien: als stream, mit fortschritt ueber die gelesenen bytes
export function gzipBlob(data: Blob, onProgress?: (done: number, total: number) => void): Promise<Blob> {
  let done = 0;
  const count = new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, ctrl) {
      done += chunk.length;
      onProgress?.(done, data.size);
      ctrl.enqueue(chunk);
    },
  });
  return new Response(data.stream().pipeThrough(count).pipeThrough(new CompressionStream("gzip") as unknown as TransformStream<Uint8Array, Uint8Array>)).blob();
}

export async function isGzip(data: Blob) {
  const head = new Uint8Array(await data.slice(0, 2).arrayBuffer());
  return head[0] === 0x1f && head[1] === 0x8b;
}

export const gunzipBlob = (data: Blob) => new Response(data.stream().pipeThrough(new DecompressionStream("gzip"))).blob();

export function checksum(data: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193);
  }
  return `${data.length}:${(h >>> 0).toString(16)}`;
}
