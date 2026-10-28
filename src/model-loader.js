export const sha256 = async (bytes) =>
  [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
export async function loadModel(base, onProgress = () => {}) {
  const response = await fetch(new URL("manifest.json", base));
  if (!response.ok)
    throw Error(`Model manifest unavailable (${response.status}).`);
  const manifest = await response.json();
  if (
    manifest.neurons !== 166700 ||
    manifest.connections !== 25582938 ||
    manifest.weight_quantization !== false
  )
    throw Error("Unrecognized fly model.");
  const groupsResponse = await fetch(new URL("visual-groups.json", base));
  if (!groupsResponse.ok) throw Error("Visual neuron populations unavailable.");
  const { groups } = await groupsResponse.json();
  for (const [name, cells] of Object.entries(groups))
    if (
      !cells.length ||
      cells.some((i) => !Number.isInteger(i) || i < 0 || i >= manifest.neurons)
    )
      throw Error(`Invalid neuron population: ${name}`);
  let cache = null,
    loaded = 0;
  try {
    cache = await caches.open("fly-backrooms-lossless-v1");
  } catch {
    /* Private browsing can disable persistent cache. */
  }
  const arrays = {};
  for (const [name, spec] of Object.entries(manifest.arrays)) {
    const bytes = new Uint8Array(spec.length * 4);
    let offset = 0;
    for (const part of spec.parts) {
      const url = new URL(part.file, base).href;
      let r = cache ? await cache.match(url) : null;
      const wasCached = Boolean(r);
      if (!r) r = await fetch(url);
      if (!r.ok) throw Error(`Model chunk ${part.file}: HTTP ${r.status}.`);
      const compressed = await r.arrayBuffer();
      if ((await sha256(compressed)) !== part.sha256) {
        if (cache) await cache.delete(url);
        throw Error(`Checksum failed for ${part.file}. Reload to retry.`);
      }
      const raw = await new Response(
        new Blob([compressed])
          .stream()
          .pipeThrough(new DecompressionStream("gzip")),
      ).arrayBuffer();
      if (
        raw.byteLength !== part.raw_bytes ||
        offset + raw.byteLength > bytes.length
      )
        throw Error(`Invalid model chunk length: ${part.file}.`);
      bytes.set(new Uint8Array(raw), offset);
      offset += raw.byteLength;
      if (cache && !wasCached)
        try {
          await cache.put(url, new Response(compressed));
        } catch {
          cache = null;
        }
      loaded += compressed.byteLength;
      onProgress(loaded / manifest.transfer_bytes);
    }
    if (offset !== bytes.length || (await sha256(bytes)) !== spec.sha256)
      throw Error(`Lossless ${name} verification failed.`);
    arrays[name] =
      spec.dtype === "float32"
        ? new Float32Array(bytes.buffer)
        : new Uint32Array(bytes.buffer);
  }
  return { manifest, groups, arrays };
}
