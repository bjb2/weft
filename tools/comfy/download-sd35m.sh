#!/usr/bin/env bash
# Download the SD 3.5 Medium GGUF stack into a ComfyUI checkout. All files come
# from the UNGATED calcuis/sd3.5-medium-gguf mirror (no HF token / license gate).
# Resumable (curl -C -). ~9.5 GB total.
#
#   COMFY=/c/Users/bryan/enclave/ComfyUI bash tools/comfy/download-sd35m.sh
set -e
: "${COMFY:?set COMFY}"
BASE="https://huggingface.co/calcuis/sd3.5-medium-gguf/resolve/main"
mkdir -p "$COMFY/models/unet" "$COMFY/models/clip" "$COMFY/models/vae"
dl(){ echo ">> $2"; curl -L -C - --retry 6 --retry-delay 4 --fail -o "$2" "$BASE/$1"; }
dl sd3.5_medium-q8_0.gguf              "$COMFY/models/unet/sd3.5_medium-q8_0.gguf"        # ~2.86 GB, near-lossless
dl clip_g.safetensors                  "$COMFY/models/clip/clip_g.safetensors"           # ~1.39 GB
dl clip_l.safetensors                  "$COMFY/models/clip/clip_l.safetensors"           # ~0.25 GB
dl t5xxl_fp8_e4m3fn.safetensors        "$COMFY/models/clip/t5xxl_fp8_e4m3fn.safetensors" # ~4.89 GB
dl diffusion_pytorch_model.safetensors "$COMFY/models/vae/sd3.5_vae.safetensors"         # ~0.17 GB (SD3.5 VAE)
echo "DOWNLOAD_DONE"
