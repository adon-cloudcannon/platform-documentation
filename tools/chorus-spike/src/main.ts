// chorus spike — Milestone 0 CLI
//
// From this directory:
//   deno task build   # chunk + embed → demo/semantic-index.json
//   deno task serve   # http://localhost:4507/
//
// Requires _site/documentation/ to exist (run `deno task build` from the repo root once).

import { chunk } from "./chunk.ts";
import { embed } from "./embed.ts";
import { embedM2V } from "./embed-m2v.ts";

const cmd = Deno.args[0];

switch (cmd) {
  case "chunk":
    await chunk();
    break;
  case "embed":
    await embed();
    break;
  case "embed-m2v":
    await embedM2V();
    break;
  case "build":
    await chunk();
    await embed();
    break;
  case "build-m2v":
    await chunk();
    await embedM2V();
    break;
  default:
    console.error(
      "Usage: deno task <chunk|embed|embed-m2v|build|build-m2v|serve|distill>",
    );
    Deno.exit(1);
}

// Force clean exit — onnxruntime-node on macOS emits a mutex error during
// its destructor otherwise. All work is already flushed to disk above.
Deno.exit(0);
