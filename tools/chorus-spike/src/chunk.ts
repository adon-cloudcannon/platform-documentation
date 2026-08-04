import { DOMParser, type Element } from "deno-dom";
import { walk } from "@std/fs";
import { relative } from "@std/path";
import type { Chunk } from "./types.ts";

const REPO_ROOT = new URL("../../../", import.meta.url).pathname;
const SITE_ROOT = `${REPO_ROOT}_site/documentation`;
const OUTPUT_DIR = new URL("../output/", import.meta.url).pathname;
const OUTPUT = `${OUTPUT_DIR}chunks.json`;

const MIN_WORDS = 15;

// Skip URLs that aren't content pages.
const SKIP_URL_PREFIXES = ["/documentation/404", "/documentation/CLAUDE"];

function textOf(el: Element): string {
  return el.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

export async function chunk() {
  try {
    await Deno.stat(SITE_ROOT);
  } catch {
    console.error(`_site not found at ${SITE_ROOT}`);
    console.error(`Run \`deno task build\` from the repo root first.`);
    Deno.exit(1);
  }
  await Deno.mkdir(OUTPUT_DIR, { recursive: true });

  const parser = new DOMParser();
  const chunks: Chunk[] = [];
  let pagesSeen = 0;

  for await (const entry of walk(SITE_ROOT, { exts: [".html"] })) {
    if (!entry.isFile) continue;

    const relPath = relative(SITE_ROOT, entry.path);
    const url = "/documentation/" +
      relPath.replace(/index\.html$/, "").replace(/\.html$/, "/");
    if (SKIP_URL_PREFIXES.some((p) => url.startsWith(p))) continue;

    const html = await Deno.readTextFile(entry.path);
    const doc = parser.parseFromString(html, "text/html");
    if (!doc) continue;

    const main = doc.querySelector("main") ?? doc.querySelector("article");
    if (!main) continue;

    pagesSeen++;

    const h1El = doc.querySelector("h1");
    const h1Text = h1El ? textOf(h1El) : "";

    const nodes = Array.from(
      main.querySelectorAll("h2, h3, p, li, pre, blockquote, td, dd"),
    );

    let anchor = "";
    let heading = "";
    let buf: string[] = [];

    const flush = () => {
      const combined = buf.join(" ").replace(/\s+/g, " ").trim();
      const wordCount = combined ? combined.split(/\s+/).length : 0;
      if (wordCount >= MIN_WORDS) {
        chunks.push({
          id: `${url}#${anchor || "top"}`,
          url,
          anchor,
          headingPath: [h1Text, heading].filter(Boolean),
          text: combined,
          wordCount,
        });
      }
    };

    for (const n of nodes) {
      const el = n as Element;
      const tag = el.tagName?.toLowerCase();
      if (tag === "h2" || tag === "h3") {
        flush();
        buf = [];
        anchor = el.getAttribute("id") ?? "";
        heading = textOf(el);
      } else {
        const t = textOf(el);
        if (t) buf.push(t);
      }
    }
    flush();
  }

  await Deno.writeTextFile(OUTPUT, JSON.stringify(chunks));
  console.log(`Pages seen:   ${pagesSeen}`);
  console.log(`Chunks kept:  ${chunks.length}`);
  console.log(`  → ${OUTPUT}`);
}
