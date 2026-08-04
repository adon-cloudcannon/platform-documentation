// chorus search preview — dev-site only, unlinked.
// Renders a self-contained semantic-search demo backed by
// /documentation/_chorus/semantic-index.json (produced by
// `deno task embed-site` in tools/chorus-spike).

const STYLE = `
.chorus-preview { max-width: 960px; margin: 2em auto; padding: 0 1em 4em; line-height: 1.45; }
.chorus-preview h1 { font-size: 1.6em; margin: 0 0 0.2em; }
.chorus-preview .subtitle { color: var(--changelog-content, #666); font-size: 0.9em; margin-bottom: 0.5em; }
.chorus-preview .encoder-badge {
  display: inline-block; font-family: ui-monospace, monospace; font-size: 0.75em;
  background: var(--accent-background, #eef); color: var(--text, #334);
  padding: 0.15em 0.5em; border-radius: 4px; margin-bottom: 1.5em;
}
.chorus-preview .encoder-badge.loading { background: #fff3cd; color: #664; }
.chorus-preview .encoder-badge.ready { background: #d4edda; color: #274; }
.chorus-preview .encoder-badge.error { background: #f8d7da; color: #712; }
.chorus-preview input[type="search"] {
  width: 100%; padding: 0.75em 1em; font-size: 1.1em;
  border: 1px solid var(--button-border, #ccc); border-radius: 8px;
  font-family: inherit; background: var(--background, white); color: var(--text, #222);
}
.chorus-preview input[type="search"]:focus { outline: 2px solid var(--selected-blue, #1976d2); outline-offset: -1px; }
.chorus-preview .test-queries { display: flex; flex-wrap: wrap; gap: 0.4em; margin: 1em 0 0.4em; }
.chorus-preview .test-queries button {
  padding: 0.35em 0.75em; font-size: 0.85em; background: var(--button-hover, #f5f5f5);
  border: 1px solid var(--button-border, #ddd); border-radius: 999px; cursor: pointer;
  font-family: inherit; color: var(--text, #222);
}
.chorus-preview .test-queries button:hover { background: var(--accent-background, #eee); }
.chorus-preview .test-queries button.active { background: var(--accent-background, #e3f2fd); border-color: var(--selected-blue, #64b5f6); }
.chorus-preview .meta { color: var(--changelog-content, #666); font-size: 0.85em; margin: 1em 0; }
.chorus-preview .warming {
  padding: 0.6em 1em; background: #fff3cd; border-radius: 6px;
  color: #664; font-size: 0.9em; margin: 1em 0;
}
.chorus-preview .results { margin-top: 0.5em; }
.chorus-preview .result { padding: 0.9em 0; border-bottom: 1px solid var(--button-border, #eee); }
.chorus-preview .result .heading-path { color: var(--changelog-content, #666); font-size: 0.82em; margin-bottom: 0.2em; }
.chorus-preview .result .heading-path .sep { opacity: 0.5; margin: 0 0.3em; }
.chorus-preview .result h3 { margin: 0 0 0.2em; font-size: 1em; }
.chorus-preview .result h3 a { color: var(--selected-blue, #1565c0); text-decoration: none; }
.chorus-preview .result h3 a:hover { text-decoration: underline; }
.chorus-preview .result .excerpt { color: var(--text, #444); font-size: 0.9em; }
.chorus-preview .result .score { float: right; color: var(--changelog-content, #999); font-family: ui-monospace, monospace; font-size: 0.8em; }
.chorus-preview .compare-link { font-size: 0.85em; color: var(--changelog-content, #666); margin-left: 0.5em; }
`;

const MARKUP = `
<div class="chorus-preview">
  <h1>Chorus search preview</h1>
  <p class="subtitle">
    Semantic search prototype for CloudCannon docs. ONNX teacher, lazy-loaded.
    Links open in this tab; "Compare on Pagefind" opens the current site's Pagefind results in a new tab.
  </p>
  <div class="encoder-badge" id="chorus-badge">encoder: not loaded</div>

  <input id="chorus-q" type="search"
         placeholder="Try: 'locking editing', 'block editors from deleting', 'widgets'"
         autocomplete="off" spellcheck="false" />

  <div class="test-queries" id="chorus-test-queries"></div>
  <div class="meta" id="chorus-meta"></div>
  <div class="results" id="chorus-results"></div>
</div>
`;

const SCRIPT = `
import { pipeline } from "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2";

const MODEL = "Xenova/multi-qa-MiniLM-L6-cos-v1";
const DIM = 384;
const INDEX_URL = "/documentation/_chorus/semantic-index.json";

const TEST_QUERIES = [
  "locking editing", "block editors from deleting", "how do I add a dropdown",
  "let translators edit only certain files", "custom styles in the editor",
  "why won't my build finish", "how do I connect my repo",
  "what's the difference between a schema and a structure",
  "widgets", "forms", "fields", "how do I let editors change page titles",
  "can I have two people editing at once", "syncing to prod",
  "images not loading", "make images look sharp", "postbuild",
  "cloudcannon.config.yml", "publish workflow", "translate my site",
];

const $ = (id) => document.getElementById(id);
const badge = $("chorus-badge");
const input = $("chorus-q");
const resultsEl = $("chorus-results");
const metaEl = $("chorus-meta");
const testEl = $("chorus-test-queries");

for (const q of TEST_QUERIES) {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = q;
  b.onclick = () => {
    for (const bb of testEl.querySelectorAll("button")) bb.classList.remove("active");
    b.classList.add("active");
    input.value = q;
    runSearch(q);
  };
  testEl.appendChild(b);
}

function setBadge(text, cls = "") {
  badge.textContent = text;
  badge.className = "encoder-badge" + (cls ? " " + cls : "");
}

let index, bytes;
try {
  const t0 = performance.now();
  const indexResp = await fetch(INDEX_URL);
  if (!indexResp.ok) throw new Error(\`index fetch: \${indexResp.status} (expected at \${INDEX_URL} — run \\\`deno task embed-site\\\` in tools/chorus-spike)\`);
  index = await indexResp.json();
  const raw = Uint8Array.from(atob(index.embeddings), (c) => c.charCodeAt(0));
  bytes = new Int8Array(raw.buffer);
  const dt = (performance.now() - t0).toFixed(0);
  setBadge(\`encoder: not loaded  ·  index: \${index.chunks.length} chunks in \${dt}ms\`);
} catch (err) {
  setBadge(\`index load failed: \${err.message}\`, "error");
  throw err;
}

let extractor = null;
let modelPromise = null;
let pendingQuery = null;

function loadModel() {
  if (modelPromise) return modelPromise;
  setBadge(\`encoder: \${MODEL} — warming up (22 MB, one-time)…\`, "loading");
  const t0 = performance.now();
  modelPromise = pipeline("feature-extraction", MODEL, { dtype: "q8" })
    .then((m) => {
      extractor = m;
      const dt = ((performance.now() - t0) / 1000).toFixed(1);
      setBadge(\`encoder: \${MODEL}  ·  ready in \${dt}s  ·  \${index.chunks.length} chunks × \${DIM}d\`, "ready");
      if (pendingQuery) { const q = pendingQuery; pendingQuery = null; runSearch(q); }
      return m;
    })
    .catch((err) => { setBadge(\`model load failed: \${err.message}\`, "error"); throw err; });
  return modelPromise;
}

const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 800));
idle(() => loadModel(), { timeout: 2000 });
input.addEventListener("focus", loadModel);

async function runSearch(q) {
  const query = q.trim();
  if (!query) { resultsEl.innerHTML = ""; metaEl.textContent = ""; return; }
  if (!extractor) {
    pendingQuery = query;
    resultsEl.innerHTML = '<div class="warming">Warming up the encoder… your query will run as soon as it\\'s ready.</div>';
    loadModel();
    return;
  }
  const t0 = performance.now();
  const out = await extractor(query, { pooling: "mean", normalize: true });
  const qv = out.data;
  const scores = new Float32Array(index.chunks.length);
  for (let i = 0; i < index.chunks.length; i++) {
    let s = 0;
    const base = i * DIM;
    for (let k = 0; k < DIM; k++) s += qv[k] * bytes[base + k];
    scores[i] = s / 127;
  }
  const top = Array.from(scores.keys()).sort((a, b) => scores[b] - scores[a]).slice(0, 10);
  const dt = (performance.now() - t0).toFixed(1);
  const pagefindUrl = \`/documentation/?q=\${encodeURIComponent(query)}\`;
  metaEl.innerHTML = \`\${index.chunks.length} chunks searched in \${dt}ms <a class="compare-link" href="\${pagefindUrl}" target="_blank">Compare on Pagefind →</a>\`;
  resultsEl.innerHTML = top.map((i) => {
    const c = index.chunks[i];
    const anchor = c.anchor ? "#" + c.anchor : "";
    const title = c.headingPath[c.headingPath.length - 1] || c.url;
    const path = c.headingPath.map(escape).join('<span class="sep">›</span>');
    return \`<div class="result">
      <span class="score">\${scores[i].toFixed(3)}</span>
      <div class="heading-path">\${path}</div>
      <h3><a href="\${c.url}\${anchor}">\${escape(title)}</a></h3>
      <div class="excerpt">\${escape(c.excerpt)}…</div>
    </div>\`;
  }).join("");
}

function escape(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let timer;
input.addEventListener("input", (e) => {
  clearTimeout(timer);
  timer = setTimeout(() => runSearch(e.target.value), 200);
});
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { clearTimeout(timer); runSearch(input.value); }
});
`;

export default function Preview() {
  return (
    <main id="main-content">
      <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      <div dangerouslySetInnerHTML={{ __html: MARKUP }} />
      <script type="module" dangerouslySetInnerHTML={{ __html: SCRIPT }} />
    </main>
  );
}
