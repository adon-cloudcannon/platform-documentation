import { pipeline } from "@huggingface/transformers";
import { encodeBase64 } from "@std/encoding";
import { resolve } from "@std/path";
import type { Chunk, SemanticIndex } from "./types.ts";

const CHUNKS_IN = new URL("../output/chunks.json", import.meta.url).pathname;
// Output dir is CWD-relative; default writes to the spike's demo folder.
// Override with CHORUS_OUT env var, e.g. `CHORUS_OUT=../../_site/documentation/_chorus`.
const OUT_DIR = resolve(Deno.env.get("CHORUS_OUT") ?? "demo");
const OUT_FILE = `${OUT_DIR}/semantic-index.json`;

const MODEL = "Xenova/multi-qa-MiniLM-L6-cos-v1";
const DIM = 384;
const BATCH = 16;
const MAX_TEXT_CHARS = 1500;

export async function embed() {
  const chunks: Chunk[] = JSON.parse(await Deno.readTextFile(CHUNKS_IN));

  console.log(`Loading ${MODEL}…`);
  // deno-lint-ignore no-explicit-any
  const extractor: any = await pipeline("feature-extraction", MODEL, {
    dtype: "q8",
  });

  console.log(`Embedding ${chunks.length} chunks (batch ${BATCH})…`);
  const int8 = new Int8Array(chunks.length * DIM);

  const t0 = performance.now();
  for (let i = 0; i < chunks.length; i += BATCH) {
    const batch = chunks.slice(i, i + BATCH);
    const inputs = batch.map((c) =>
      `${c.headingPath.join(" > ")}\n${c.text.slice(0, MAX_TEXT_CHARS)}`
    );
    const output = await extractor(inputs, {
      pooling: "mean",
      normalize: true,
    });
    const data = output.data as Float32Array;

    for (let j = 0; j < batch.length; j++) {
      const srcStart = j * DIM;
      const dstStart = (i + j) * DIM;
      for (let k = 0; k < DIM; k++) {
        const v = Math.round(data[srcStart + k] * 127);
        int8[dstStart + k] = Math.max(-127, Math.min(127, v));
      }
    }

    const done = Math.min(i + BATCH, chunks.length);
    const rate = done / ((performance.now() - t0) / 1000);
    console.log(`  ${done}/${chunks.length}  (${rate.toFixed(1)}/s)`);
  }

  const index: SemanticIndex = {
    model: MODEL,
    dim: DIM,
    version: 1,
    chunks: chunks.map((c) => ({
      id: c.id,
      url: c.url,
      anchor: c.anchor,
      headingPath: c.headingPath,
      excerpt: c.text.slice(0, 240),
    })),
    embeddings: encodeBase64(int8.buffer),
  };

  const json = JSON.stringify(index);
  await Deno.mkdir(OUT_DIR, { recursive: true });
  await Deno.writeTextFile(OUT_FILE, json);

  console.log(`Wrote index: ${chunks.length} × ${DIM}d int8`);
  console.log(`JSON size:   ${(json.length / 1024).toFixed(1)} KB`);
  console.log(`  → ${OUT_FILE}`);
}
