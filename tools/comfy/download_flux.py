#!/usr/bin/env python3
r"""Download the FLUX.1-dev stack for the isekai ComfyUI. Windows-native, no bash.

Run with the ComfyUI embedded Python (has huggingface_hub + hf-xet for speed):

  C:\Users\bryan\enclave\isekai-fighter\pipeline\comfyui\python_embeded\python.exe ^
      C:\Users\bryan\enclave\weft\tools\comfy\download_flux.py

Resumable: re-run anytime; completed files are skipped, partials continue.
Text encoders (t5xxl_bf16 + clip_l) are reused from the SD3.5 setup — not fetched.
FLUX.1-dev is non-commercial (accepted for this project). All repos below are ungated.
"""
import os, shutil
from huggingface_hub import hf_hub_download

ENC = r"C:\Users\bryan\enclave\ComfyUI\models"                                  # mapped into ComfyUI as unet/ clip/ vae/
ISK = r"C:\Users\bryan\enclave\isekai-fighter\pipeline\comfyui\ComfyUI\models"  # ComfyUI's own model root

# (repo_id, file in repo, final absolute destination)
JOBS = [
    ("city96/FLUX.1-dev-gguf",                 "flux1-dev-Q4_K_S.gguf",                 os.path.join(ENC, "unet", "flux1-dev-Q4_K_S.gguf")),
    ("YarvixPA/FLUX.1-Fill-dev-GGUF",          "flux1-fill-dev-Q4_K_S.gguf",            os.path.join(ENC, "unet", "flux1-fill-dev-Q4_K_S.gguf")),
    ("Comfy-Org/Lumina_Image_2.0_Repackaged",  "split_files/vae/ae.safetensors",        os.path.join(ENC, "vae", "ae.safetensors")),
    ("city96/t5-v1_1-xxl-encoder-gguf",        "t5-v1_1-xxl-encoder-Q5_K_M.gguf",       os.path.join(ENC, "clip", "t5-v1_1-xxl-encoder-Q5_K_M.gguf")),
    ("XLabs-AI/flux-ip-adapter-v2",            "ip_adapter.safetensors",                os.path.join(ISK, "xlabs", "ipadapters", "flux-ip-adapter-v2.safetensors")),
    ("openai/clip-vit-large-patch14",          "model.safetensors",                     os.path.join(ISK, "clip_vision", "clip-vit-large-patch14.safetensors")),
    ("XLabs-AI/flux-controlnet-collections",   "flux-depth-controlnet-v3.safetensors",  os.path.join(ISK, "xlabs", "controlnets", "flux-depth-controlnet-v3.safetensors")),
    ("Kim2091/UltraSharp",                     "4x-UltraSharp.pth",                     os.path.join(ISK, "upscale_models", "4x-UltraSharp.pth")),
]

def get(repo, fn, dest):
    if os.path.exists(dest) and os.path.getsize(dest) > 1_000_000:
        print(f"skip (already present): {os.path.basename(dest)}")
        return
    d = os.path.dirname(dest)
    os.makedirs(d, exist_ok=True)
    print(f"downloading {repo}/{fn} ...")
    got = hf_hub_download(repo_id=repo, filename=fn, local_dir=d)  # resumes; hf-xet fast path
    if os.path.abspath(got) != os.path.abspath(dest):
        os.replace(got, dest)
        # tidy any nested dirs the repo path created (e.g. split_files/vae/)
        sub = os.path.dirname(os.path.relpath(got, d))
        if sub:
            shutil.rmtree(os.path.join(d, sub.split(os.sep)[0]), ignore_errors=True)
    print(f"  -> {dest}  ({os.path.getsize(dest)/1e9:.2f} GB)")

if __name__ == "__main__":
    for repo, fn, dest in JOBS:
        get(repo, fn, dest)
    print("\nALL FLUX MODELS PRESENT")
