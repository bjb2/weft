# Local image generation (ComfyUI + SD 3.5 Medium)

Optional, fully local art pipeline for weft games. Generates scene banners and character
portraits from each game's `art/prompts.json` via a local ComfyUI server, writing
`assets/<slot>.png`. No API key, no per-image cost.

> Status: the setup scripts and workflow are complete and correct. On the machine we built
> this on it was blocked by environment issues (see **Gotchas**); it runs cleanly on a normal
> Python install. A known-good ComfyUI lives at `enclave/isekai-fighter` for reference.

## Files
- `install.sh` — clone ComfyUI + the GGUF custom node into `$COMFY`, make a venv, install
  CUDA PyTorch + requirements.
- `download-sd35m.sh` — pull the SD 3.5 Medium GGUF stack from the **ungated**
  `calcuis/sd3.5-medium-gguf` mirror (model q8 + clip_g + clip_l + t5 + VAE), ~9.5 GB, resumable.
- `gen.py` — read a game's `art/prompts.json`, build the SD3.5 workflow per slot, POST to the
  ComfyUI API, save PNGs (deterministic seed per slot; pfps square, scenes 3:2).
- `sd35-medium.json` — the same workflow in ComfyUI **UI format** (drag into the web UI).

## Setup
```bash
export COMFY=/path/to/ComfyUI          # outside the weft repo; it is large
bash tools/comfy/install.sh
bash tools/comfy/download-sd35m.sh
# start the server (run from $COMFY)
"$COMFY/.venv/Scripts/python.exe" "$COMFY/main.py" --port 8188 --lowvram
```

## Generate
```bash
PY="$COMFY/.venv/Scripts/python.exe"
"$PY" tools/comfy/gen.py --game games/saltbell --all          # every slot
"$PY" tools/comfy/gen.py --game games/threadkeeper --slots marsh:1216x832 yue:1024x1024
```
`build` prefers `assets/<name>.png` over the `.svg` placeholder, so generated art shows up
automatically; the portal cards pick it up too.

## Character consistency (`charstudio.py`)

Keeping invented characters on-design across portraits and scenes, fully local,
commercially clean (SD 3.5 community license), and with **no manual curation**.
Three stages; the first two are proven and run from here over HTTP, the third
(training) runs in your own terminal.

**1. Bootstrap a training set from a text brief** — `--mode dataset`. Generates a
deterministic hero (upper-body, plain background), then img2img-riffs it across a
fixed expression/lighting sweep at low denoise. Low denoise locks identity, so
every frame is on-model and no human pruning is needed. Captions are written
deterministically (we authored the sweep, so each frame's view is known — no
captioner). Output is a kohya-ready folder.
```bash
python tools/comfy/charstudio.py --mode dataset \
  --brief "a lean gatekeeper monk with a shaved head and a bamboo staff" \
  --token sb_ren --style "<the ink-wash descriptor>" \
  --out games/saltbell/art/lora --n 24 --denoise 0.5
```

**2. Train a per-character LoRA** — see `lora-train.example.toml` (kohya sd-scripts
`sd3` branch; needs the non-GGUF SD3.5 Medium weights). ~30-90 min/character on a
3080. Produces `<token>.safetensors`.

**3. Render with the LoRA** — single character: load its LoRA in a normal
generation. **Multiple characters in one scene** — `--mode composite`: render the
empty background, then inpaint each character into their own region in a separate
pass with **only that character's LoRA loaded**. One identity active per pass is
why a multi-character banner never bleeds features between characters.
```bash
python tools/comfy/charstudio.py --mode composite \
  --bg "a stone temple courtyard at dusk, mist, lanterns" \
  --briefs "Ren, a gatekeeper monk ..." "Master Lou, a blind sect master ..." \
  --loras sb_ren sb_lou \
  --style "<the ink-wash descriptor>" --out banner.png --w 1216 --h 832 --denoise 0.85
```
Regions are derived from cast count (1=center, 2=L/R, 3=thirds); masks are built
from ComfyUI core nodes (no external mask files). Pass `-` in `--loras` (or omit)
for a prompt-only character. Without trained LoRAs the compositing still works —
each character is a fresh interpretation of its brief rather than the exact design.

## Gotchas (learned the hard way)
- **Use a normal Python, NOT the Microsoft-Store Python.** The Store build
  (`...\WindowsApps\PythonSoftwareFoundation.Python...`) runs in a sandbox that breaks native
  CUDA extensions: `torchaudio`'s `.pyd` fails to load (`WinError 127`) and tensor loading in
  ComfyUI hits a fatal *access violation*. Build the venv from a python.org / standard install.
- **fp8 is unusable on Ampere (RTX 30xx).** The `t5xxl_fp8_e4m3fn` encoder access-violates when
  moved to the GPU (and even a CPU `fp8 → bf16` cast crashes in some torch builds). Use a
  non-fp8 t5 (`t5xxl_fp16` / bf16) or a **GGUF t5** instead. `gen.py` and `sd35-medium.json`
  reference `t5xxl_bf16.safetensors`.
- `torchaudio` is not needed for image generation; if its import blocks ComfyUI, a tiny stub
  package on `sys.path` named `torchaudio` is enough.
- 10 GB VRAM: run ComfyUI with `--lowvram`; the bf16 t5 (~9.8 GB) lives in RAM and offloads.

## Swapping models
The model is just the workflow's loader nodes. To try FLUX.1-schnell (Apache-2.0) instead,
point a copy of the workflow at the city96 schnell GGUF + flux text encoders; everything else
(the API contract in `gen.py`) is unchanged.
