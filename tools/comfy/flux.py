#!/usr/bin/env python3
"""FLUX.1-dev generator for weft — training-free character consistency.

Uses the XLabs FLUX IP-Adapter: generate a clean reference portrait once, then
drive scenes from it so the character stays on-model with NO LoRA training. Pure
HTTP against a running ComfyUI (no torch here).

Nodes (verified against /object_info): UnetLoaderGGUF(flux1-dev) + DualCLIPLoader
(clip_l + t5xxl_bf16, type=flux) + VAELoader(ae) -> CLIPTextEncode/FluxGuidance,
optional LoadFluxIPAdapter+ApplyFluxIPAdapter, XlabsSampler -> VAEDecode.
"""
import argparse, json, os, time, urllib.request, urllib.parse, uuid, hashlib, io

FLUX_UNET = "flux1-dev-Q4_K_S.gguf"
AE = "ae.safetensors"
IPA = "flux-ip-adapter-v2.safetensors"
IPA_CLIPV = "clip-vit-large-patch14.safetensors"
NEG = "blurry, low quality, deformed, bad anatomy, extra limbs, extra fingers, text, watermark, signature, jpeg artifacts"

def workflow_flux(prompt, neg, seed, w, h, ref_name=None, ip_scale=0.9, steps=20, guidance=3.5, true_gs=3.5):
    g = {
        "u":  {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": FLUX_UNET}},
        "c":  {"class_type": "DualCLIPLoaderGGUF", "inputs": {"clip_name1": "clip_l.safetensors", "clip_name2": "t5-v1_1-xxl-encoder-Q5_K_M.gguf", "type": "flux"}},
        "v":  {"class_type": "VAELoader", "inputs": {"vae_name": AE}},
        "pe": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["c", 0], "text": prompt}},
        "pg": {"class_type": "FluxGuidance", "inputs": {"conditioning": ["pe", 0], "guidance": guidance}},
        "ne": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["c", 0], "text": neg}},
        "l":  {"class_type": "EmptySD3LatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}},
    }
    model = ["u", 0]
    if ref_name:
        # NB: XLabs node's input key is the literal misspelling "ipadatper".
        g["ipl"] = {"class_type": "LoadFluxIPAdapter", "inputs": {"ipadatper": IPA, "clip_vision": IPA_CLIPV, "provider": "GPU"}}
        g["img"] = {"class_type": "LoadImage", "inputs": {"image": ref_name}}
        g["ip"]  = {"class_type": "ApplyFluxIPAdapter", "inputs": {"model": model, "ip_adapter_flux": ["ipl", 0], "image": ["img", 0], "ip_scale": ip_scale}}
        model = ["ip", 0]
    g["k"] = {"class_type": "KSampler", "inputs": {
        "model": model, "positive": ["pg", 0], "negative": ["ne", 0], "latent_image": ["l", 0],
        "seed": seed, "steps": steps, "cfg": 1.0,
        "sampler_name": "euler", "scheduler": "simple", "denoise": 1.0}}
    g["d"] = {"class_type": "VAEDecode", "inputs": {"samples": ["k", 0], "vae": ["v", 0]}}
    g["s"] = {"class_type": "SaveImage", "inputs": {"images": ["d", 0], "filename_prefix": "weft_flux"}}
    return g

# --- HTTP helpers ----------------------------------------------------------
def post(comfy, wf, cid):
    body = json.dumps({"prompt": wf, "client_id": cid}).encode()
    req = urllib.request.Request(comfy + "/prompt", body, {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=30))["prompt_id"]

def wait(comfy, pid, timeout=600):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            h = json.load(urllib.request.urlopen(comfy + "/history/" + pid, timeout=15))
        except Exception:
            h = {}
        if pid in h:
            r = h[pid]
            if r.get("status", {}).get("status_str") == "error":
                raise RuntimeError(json.dumps(r.get("status"))[:600])
            return r
        time.sleep(2)
    raise TimeoutError("generation timed out")

def first_image(res):
    for node in res.get("outputs", {}).values():
        for im in node.get("images", []):
            return im
    return None

def fetch(comfy, img, out):
    q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img.get("type", "output")})
    with open(out, "wb") as f:
        f.write(urllib.request.urlopen(comfy + "/view?" + q, timeout=120).read())
    return out

def upload(comfy, path, name):
    with open(path, "rb") as f:
        data = f.read()
    b = "----weftflux" + uuid.uuid4().hex
    buf = io.BytesIO(); w = lambda s: buf.write(s if isinstance(s, bytes) else s.encode())
    w(f"--{b}\r\n"); w(f'Content-Disposition: form-data; name="image"; filename="{name}"\r\n')
    w("Content-Type: image/png\r\n\r\n"); w(data); w("\r\n")
    w(f"--{b}\r\n"); w('Content-Disposition: form-data; name="overwrite"\r\n\r\n'); w("true\r\n")
    w(f"--{b}--\r\n")
    req = urllib.request.Request(comfy + "/upload/image", buf.getvalue(), {"Content-Type": f"multipart/form-data; boundary={b}"})
    return json.load(urllib.request.urlopen(req, timeout=30))["name"]

def seed_for(s):
    return int(hashlib.sha1(s.encode()).hexdigest()[:8], 16)

def run(comfy, wf, out, cid, label):
    t0 = time.time()
    res = wait(comfy, post(comfy, wf, cid))
    im = first_image(res)
    if not im:
        print(f"  FAIL {label}"); return None
    fetch(comfy, im, out)
    print(f"  ok {label} -> {os.path.basename(out)}  ({time.time()-t0:.0f}s)")
    return out

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--comfy", default="http://127.0.0.1:8188")
    ap.add_argument("--out", required=True)
    ap.add_argument("--ip-scale", type=float, default=0.9)
    ap.add_argument("--portrait-only", action="store_true")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    cid = uuid.uuid4().hex
    style = "cinematic wuxia illustration, ink-wash texture, moonlit indigo-blue palette with warm gold accents, painterly, atmospheric"

    # 1) reference portrait (no IP-Adapter)
    ren = "a lean gatekeeper monk, shaved head, weathered face, dark blue hanfu robe, brown sash, holding a bamboo staff"
    p = os.path.join(a.out, "ref_ren.png")
    run(a.comfy, workflow_flux(f"{ren}. upper body portrait, plain grey background. {style}", NEG, seed_for("ren"), 1024, 1024),
        p, cid, "flux portrait (Ren)")
    ref = upload(a.comfy, p, "weftflux_ref_ren.png")

    # 2) same character in a scene, driven by the portrait via IP-Adapter
    if a.portrait_only:
        return
    scene = f"{ren}, standing at a stone temple gate at dusk, mist, paper lanterns. {style}, wide cinematic banner"
    try:
        run(a.comfy, workflow_flux(scene, NEG, seed_for("ren_scene"), 1216, 832, ref_name=ref, ip_scale=a.ip_scale),
            os.path.join(a.out, "scene_ren_ip.png"), cid, "flux scene (Ren via IP-Adapter)")
    except Exception as e:
        print(f"  scene FAILED (likely paging-file/commit limit on IP-Adapter load): {e}")

if __name__ == "__main__":
    main()
