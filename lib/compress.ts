async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Blob([data as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

export const gzip = (data: Uint8Array) => pipe(data, new CompressionStream("gzip"));
export const gunzip = (data: Uint8Array) => pipe(data, new DecompressionStream("gzip"));

export function checksum(data: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < data.length; i++) {
    h ^= data[i];
    h = Math.imul(h, 0x01000193);
  }
  return `${data.length}:${(h >>> 0).toString(16)}`;
}
