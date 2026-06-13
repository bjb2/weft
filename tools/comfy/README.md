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
