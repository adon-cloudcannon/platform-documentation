// Shared M2V encoder: WordPiece tokenizer + int8 table lookup + mean-pool + L2 normalize.
// Runs identically in Deno and in the browser (plain ESM, no dependencies).

function basicTokenize(text, lowerCase = true) {
  const s = lowerCase ? text.toLowerCase() : text;
  const out = [];
  let buf = "";
  for (const ch of s) {
    if (/\s/.test(ch)) {
      if (buf) { out.push(buf); buf = ""; }
    } else if (/[\p{P}\p{S}]/u.test(ch)) {
      if (buf) { out.push(buf); buf = ""; }
      out.push(ch);
    } else {
      buf += ch;
    }
  }
  if (buf) out.push(buf);
  return out;
}

function wordpieceTokenize(word, vocab, unkId, maxCharsPerWord = 100) {
  if (word.length > maxCharsPerWord) return [unkId];
  const ids = [];
  let start = 0;
  while (start < word.length) {
    let end = word.length;
    let curId = -1;
    while (start < end) {
      const sub = start === 0 ? word.slice(start, end) : "##" + word.slice(start, end);
      const id = vocab.get(sub);
      if (id !== undefined) { curId = id; break; }
      end--;
    }
    if (curId === -1) return [unkId];
    ids.push(curId);
    start = end;
  }
  return ids;
}

export class M2V {
  constructor({ vectors, dim, vocabSize, scale, vocab, unkId, doLowerCase = true }) {
    this.vectors = vectors;
    this.dim = dim;
    this.vocabSize = vocabSize;
    this.scale = scale;
    this.vocab = vocab;
    this.unkId = unkId;
    this.doLowerCase = doLowerCase;
  }

  static async loadHttp(base = "./") {
    const [config, vocabText, vectorsBuf] = await Promise.all([
      fetch(base + "m2v-config.json").then((r) => r.json()),
      fetch(base + "m2v-vocab.txt").then((r) => r.text()),
      fetch(base + "m2v-vectors.bin").then((r) => r.arrayBuffer()),
    ]);
    return M2V.fromParts(config, vocabText, new Int8Array(vectorsBuf));
  }

  static fromParts(config, vocabText, vectorsInt8) {
    const vocab = new Map();
    const lines = vocabText.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (lines[i]) vocab.set(lines[i], i);
    }
    return new M2V({
      vectors: vectorsInt8,
      dim: config.dim,
      vocabSize: config.vocab_size,
      scale: config.scale,
      vocab,
      unkId: config.unk_id,
      doLowerCase: config.do_lower_case ?? true,
    });
  }

  tokenize(text) {
    const words = basicTokenize(text, this.doLowerCase);
    const ids = [];
    for (const w of words) {
      const wpIds = wordpieceTokenize(w, this.vocab, this.unkId);
      for (const id of wpIds) ids.push(id);
    }
    return ids;
  }

  encode(text) {
    const ids = this.tokenize(text);
    const out = new Float32Array(this.dim);
    if (ids.length === 0) return out;

    for (const id of ids) {
      const base = id * this.dim;
      for (let k = 0; k < this.dim; k++) out[k] += this.vectors[base + k];
    }

    const inv = this.scale / ids.length;
    let norm2 = 0;
    for (let k = 0; k < this.dim; k++) {
      out[k] *= inv;
      norm2 += out[k] * out[k];
    }
    const norm = Math.sqrt(norm2);
    if (norm > 0) {
      for (let k = 0; k < this.dim; k++) out[k] /= norm;
    }
    return out;
  }
}
