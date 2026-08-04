// chorus spike — Milestone 0 CLI
//
// From this directory:
//   deno task build   # chunk + embed → demo/semantic-index.json
//   deno task serve   # http://localhost:4507/
//
// Requires _site/documentation/ to exist (run `deno task build` from the repo root once).

import { chunk } from "./chunk.ts";
import { embed } from "./embed.ts";

const cmd = Deno.args[0];

switch (cmd) {
  case "chunk":
    await chunk();
    break;
  case "embed":
    await embed();
    break;
  case "build":
    await chunk();
    await embed();
    break;
  default:
    console.error("Usage: deno task <chunk|embed|build|serve>");
    Deno.exit(1);
}

// Force clean exit — onnxruntime-node on macOS emits a mutex error during
// its destructor otherwise. All work is already flushed to disk above.
Deno.exit(0);
