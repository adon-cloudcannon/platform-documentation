"""Load a pretrained Model2Vec model OR distill our own, and dump to a JS-friendly format.

Requires:  pip install -r requirements.txt
Run from tools/chorus-spike/:  python distill/distill.py

Writes to ../demo/:
  m2v-vectors.bin  — int8 [vocab, dim] row-major
  m2v-vocab.txt    — one token per line; line index = token id
  m2v-config.json  — { dim, vocab_size, scale, source, unk_id, ... }
"""
from pathlib import Path
import json
import numpy as np

# --- Which model to use ---------------------------------------------------
# "pretrained"  → load an off-the-shelf Model2Vec model from HF (recommended)
# "distill"     → distill a sentence-transformer teacher ourselves
MODE = "pretrained"

# For MODE == "pretrained"
PRETRAINED = "minishlab/potion-retrieval-32M"

# For MODE == "distill"
TEACHER = "sentence-transformers/multi-qa-MiniLM-L6-cos-v1"
PCA_DIMS = 384
# --------------------------------------------------------------------------

OUT = Path(__file__).resolve().parent.parent / "demo"
OUT.mkdir(exist_ok=True)

if MODE == "pretrained":
    from model2vec import StaticModel
    print(f"Loading pretrained M2V: {PRETRAINED}…")
    m2v = StaticModel.from_pretrained(PRETRAINED)
    source_name = PRETRAINED
elif MODE == "distill":
    from model2vec.distill import distill
    print(f"Distilling {TEACHER} → M2V (PCA {PCA_DIMS})…")
    m2v = distill(model_name=TEACHER, pca_dims=PCA_DIMS)
    source_name = f"{TEACHER} → PCA {PCA_DIMS}"
else:
    raise ValueError(f"Unknown MODE: {MODE}")

vectors = m2v.embedding.astype(np.float32)
tokenizer = m2v.tokenizer

scale = float(np.abs(vectors).max() / 127.0)
vectors_int8 = np.clip(np.round(vectors / scale), -127, 127).astype(np.int8)

(OUT / "m2v-vectors.bin").write_bytes(vectors_int8.tobytes())

vocab = tokenizer.get_vocab()
sorted_tokens = [tok for tok, _ in sorted(vocab.items(), key=lambda x: x[1])]
(OUT / "m2v-vocab.txt").write_text("\n".join(sorted_tokens))

config = {
    "dim": int(vectors.shape[1]),
    "vocab_size": int(vectors.shape[0]),
    "scale": scale,
    "source": source_name,
    "mode": MODE,
    "pad_id": vocab.get("[PAD]", 0),
    "unk_id": vocab.get("[UNK]", 100),
    "cls_id": vocab.get("[CLS]", 101),
    "sep_id": vocab.get("[SEP]", 102),
    "do_lower_case": True,
}
(OUT / "m2v-config.json").write_text(json.dumps(config, indent=2))

print(f"Vectors:  {vectors_int8.nbytes / 1024 / 1024:.2f} MB  "
      f"({vectors.shape[0]} × {vectors.shape[1]})")
print(f"Vocab:    {len(sorted_tokens)} tokens")
print(f"Scale:    {scale:.6f}")
print(f"Written to {OUT}")
