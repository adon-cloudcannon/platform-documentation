import { encodeBase64 } from "@std/encoding";
// @ts-ignore — plain-JS module, no .d.ts for the spike
import { M2V } from "./m2v.js";
import type { Chunk, SemanticIndex } from "./types.ts";

const CHUNKS_IN = new URL("../output/chunks.json", import.meta.url).pathname;
const DEMO_DIR = new URL("../demo/", import.meta.url).pathname;
const DEMO_OUT = `${DEMO_DIR}semantic-index-m2v.json`;
const M2V_SRC = new URL("./m2v.js", import.meta.url).pathname;
const M2V_DEMO_COPY = `${DEMO_DIR}m2v.js`;

const MAX_TEXT_CHARS = 1500;

export async function embedM2V() {
  const chunks: Chunk[] = JSON.parse(await Deno.readTextFile(CHUNKS_IN));

  console.log(`Loading M2V from ${DEMO_DIR}…`);
  const m2v = await loadFromDisk(DEMO_DIR);
  const dim: number = m2v.dim;
  console.log(`  dim=${dim}  vocab=${m2v.vocabSize}`);

  console.log(`Embedding ${chunks.length} chunks with M2V…`);
  const int8 = new Int8Array(chunks.length * dim);

  const t0 = performance.now();
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i];
    const text = `${c.headingPath.join(" > ")}\n${c.text.slice(0, MAX_TEXT_CHARS)}`;
    const vec: Float32Array = m2v.encode(text);

    const base = i * dim;
    for (let k = 0; k < dim; k++) {
      const v = Math.round(vec[k] * 127);
      int8[base + k] = Math.max(-127, Math.min(127, v));
    }

    if (i > 0 && (i % 500 === 0 || i === chunks.length - 1)) {
      const rate = (i + 1) / ((performance.now() - t0) / 1000);
      console.log(`  ${i + 1}/${chunks.length}  (${rate.toFixed(0)}/s)`);
    }
  }

  const configText = await Deno.readTextFile(`${DEMO_DIR}m2v-config.json`);
  const cfg = JSON.parse(configText);
  const sourceLabel = cfg.source ?? "unknown";

  const index: SemanticIndex = {
    model: `M2V(${sourceLabel}, dim=${dim})`,
    dim,
    version: 2,
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
  await Deno.writeTextFile(DEMO_OUT, json);
  await Deno.copyFile(M2V_SRC, M2V_DEMO_COPY);
  console.log(`JSON size:   ${(json.length / 1024).toFixed(1)} KB`);
  console.log(`  → ${DEMO_OUT}`);
  console.log(`  → ${M2V_DEMO_COPY}  (browser copy of m2v.js)`);
}

async function loadFromDisk(baseDir: string) {
  const [configText, vocabText, vectorsBytes] = await Promise.all([
    Deno.readTextFile(`${baseDir}m2v-config.json`),
    Deno.readTextFile(`${baseDir}m2v-vocab.txt`),
    Deno.readFile(`${baseDir}m2v-vectors.bin`),
  ]);
  const config = JSON.parse(configText);
  const vectorsInt8 = new Int8Array(
    vectorsBytes.buffer,
    vectorsBytes.byteOffset,
    vectorsBytes.byteLength,
  );
  return M2V.fromParts(config, vocabText, vectorsInt8);
}
