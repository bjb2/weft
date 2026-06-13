#!/usr/bin/env bash
# Canonical local image-gen setup for weft. Installs a ComfyUI venv with CUDA
# PyTorch + the GGUF custom node. ComfyUI itself lives OUTSIDE the repo (it is
# large); point COMFY at it. Idempotent — safe to re-run.
#
#   COMFY=/c/Users/bryan/enclave/ComfyUI bash tools/comfy/install.sh
#
# Prereqs: a real (Windows/Linux) Python 3.11, git, an NVIDIA GPU + recent driver.
set -e
: "${COMFY:?set COMFY to your ComfyUI checkout dir}"
: "${TORCH_INDEX:=https://download.pytorch.org/whl/cu124}"

[ -d "$COMFY/.git" ] || git clone --depth 1 https://github.com/comfyanonymous/ComfyUI "$COMFY"
[ -d "$COMFY/custom_nodes/ComfyUI-GGUF/.git" ] || \
  git clone --depth 1 https://github.com/city96/ComfyUI-GGUF "$COMFY/custom_nodes/ComfyUI-GGUF"

# venv (Windows-store python lays Scripts/python.exe; Linux lays bin/python)
PY="$COMFY/.venv/Scripts/python.exe"; [ -f "$PY" ] || PY="$COMFY/.venv/bin/python"
if [ ! -f "$PY" ]; then
  python3 -m venv "$COMFY/.venv"
  PY="$COMFY/.venv/Scripts/python.exe"; [ -f "$PY" ] || PY="$COMFY/.venv/bin/python"
fi

"$PY" -m pip install --upgrade pip wheel
"$PY" -m pip install torch torchvision --index-url "$TORCH_INDEX"
"$PY" -m pip install -r "$COMFY/requirements.txt"
"$PY" -m pip install -r "$COMFY/custom_nodes/ComfyUI-GGUF/requirements.txt"
"$PY" -c "import torch; print('torch', torch.__version__, 'cuda', torch.cuda.is_available())"
echo "INSTALL_DONE"
