#!/usr/bin/env python3
"""IP-Adapter consistency prototype (Illustrious-XL / SDXL).

A training-free, compositing-free alternative to the LoRA + region-inpaint path:
generate a clean character PORTRAIT once, then drive scenes from it as an
IP-Adapter reference so the character stays on-model. For multiple characters in
one scene, apply each portrait as a separately-masked IP-Adapter reference in a
SINGLE pass (regional IP-Adapter) — no per-character training, no sequential
inpainting.

Prototype run (pure HTTP against a running ComfyUI):
  1. one clean reference portrait per character (txt2img),
  2. a single-character scene driven by that portrait,
  3. a two-character scene with regional IP-Adapter (ref A left, ref B right).

No torch here; safe from the harness.
"""
import argparse, json, os, time, urllib.request, urllib.parse, uuid, hashlib, io

CKPT = "Illustrious-XL-v1.0.safetensors"
POS = "masterpiece, best quality, highly detailed, "
NEG = ("(text:1.3), (signature:1.4), (watermark:1.4), logo, title, "
       "lowres, worst quality, low quality, jpeg artifacts, blurry, "
       "bad anatomy, bad hands, missing fingers, extra digits, deformed, extra limbs, ugly")

# --- graph fragments -------------------------------------------------------
def _base(prompt, neg):
    return {
        "m": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": CKPT}},
        "p": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["m", 1], "text": POS + prompt}},
        "n": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["m", 1], "text": neg}},
    }

def _ksampler(model_ref, latent_ref, seed, steps, cfg, denoise=1.0):
    return {"class_type": "KSampler", "inputs": {
        "model": model_ref, "positive": ["p", 0], "negative": ["n", 0], "latent_image": latent_ref,
        "seed": seed, "steps": steps, "cfg": cfg,
        "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": denoise}}

def workflow_portrait(prompt, neg, seed, w, h, steps=28, cfg=5.5):
    g = _base(prompt, neg)
    g["l"] = {"class_type": "EmptyLatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}}
    g["k"] = _ksampler(["m", 0], ["l", 0], seed, steps, cfg)
    g["d"] = {"class_type": "VAEDecode", "inputs": {"samples": ["k", 0], "vae": ["m", 2]}}
    g["s"] = {"class_type": "SaveImage", "inputs": {"images": ["d", 0], "filename_prefix": "weft_ip"}}
    return g

def _mask(g, key, region, W, H, feather=64):
    """Build a feathered rectangular MASK from core nodes; return its [key,0] ref."""
    x, y, rw, rh = region
    g[key + "b"] = {"class_type": "SolidMask", "inputs": {"value": 0.0, "width": W, "height": H}}
    g[key + "r"] = {"class_type": "SolidMask", "inputs": {"value": 1.0, "width": rw, "height": rh}}
    g[key + "c"] = {"class_type": "MaskComposite", "inputs": {"destination": [key + "b", 0], "source": [key + "r", 0], "x": x, "y": y, "operation": "add"}}
    g[key + "f"] = {"class_type": "FeatherMask", "inputs": {"mask": [key + "c", 0], "left": feather, "top": feather, "right": feather, "bottom": feather}}
    return [key + "f", 0]

def workflow_ipscene(prompt, neg, seed, refs, W, H, steps=28, cfg=5.5, weight=0.7, wtype="ease in-out", scaling="K+V"):
    """refs = list of (image_name, region_or_None). Each becomes a masked
    IP-Adapter pass chained onto the model. region None = whole-image influence."""
    g = _base(prompt, neg)
    g["ipl"] = {"class_type": "IPAdapterUnifiedLoader", "inputs": {"model": ["m", 0], "preset": "PLUS (high strength)"}}
    model_ref = ["ipl", 0]
    for i, (img_name, region) in enumerate(refs):
        g[f"img{i}"] = {"class_type": "LoadImage", "inputs": {"image": img_name}}
        adv = {"class_type": "IPAdapterAdvanced", "inputs": {
            "model": model_ref, "ipadapter": ["ipl", 1], "image": [f"img{i}", 0],
            "weight": weight, "weight_type": wtype, "combine_embeds": "concat",
            "start_at": 0.0, "end_at": 1.0, "embeds_scaling": scaling}}
        if region is not None:
            adv["inputs"]["attn_mask"] = _mask(g, f"msk{i}", region, W, H)
        g[f"ip{i}"] = adv
        model_ref = [f"ip{i}", 0]
    g["l"] = {"class_type": "EmptyLatentImage", "inputs": {"width": W, "height": H, "batch_size": 1}}
    g["k"] = _ksampler(model_ref, ["l", 0], seed, steps, cfg)
    g["d"] = {"class_type": "VAEDecode", "inputs": {"samples": ["k", 0], "vae": ["m", 2]}}
    g["s"] = {"class_type": "SaveImage", "inputs": {"images": ["d", 0], "filename_prefix": "weft_ip"}}
    return g

# --- HTTP helpers ----------------------------------------------------------
def post(comfy, wf, cid):
    body = json.dumps({"prompt": wf, "client_id": cid}).encode()
    req = urllib.request.Request(comfy + "/prompt", body, {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=30))["prompt_id"]

def wait(comfy, pid, timeout=300):
    t0 = time.time()
    while time.time() - t0 < timeout:
        try:
            h = json.load(urllib.request.urlopen(comfy + "/history/" + pid, timeout=15))
        except Exception:
            h = {}
        if pid in h:
            r = h[pid]
            if r.get("status", {}).get("status_str") == "error":
                raise RuntimeError(json.dumps(r.get("status"))[:500])
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
        f.write(urllib.request.urlopen(comfy + "/view?" + q, timeout=60).read())
    return out

def upload(comfy, path, name):
    with open(path, "rb") as f:
        data = f.read()
    b = "----weftip" + uuid.uuid4().hex
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
    ap.add_argument("--out", required=True, help="output directory")
    ap.add_argument("--style", default="anime wuxia illustration, hanfu robes, soft cinematic lighting, indigo and gold palette")
    ap.add_argument("--scene", default="a stone temple courtyard at dusk, mist, paper lanterns")
    a = ap.parse_args()
    os.makedirs(a.out, exist_ok=True)
    cid = uuid.uuid4().hex
    W, H = 1216, 832

    cast = [
        ("ren", "a lean gatekeeper monk, shaved head, weathered face, dark blue hanfu robe, brown sash, holding a bamboo staff"),
        ("lou", "a frail blind elderly sect master, long white beard, faded saffron-gold robes, closed pale eyes"),
    ]
    portrait_tail = ". upper body portrait, front view, plain grey background, solo, " + a.style + ". no text"

    # 1) reference portraits
    refs = {}
    for tok, brief in cast:
        p = os.path.join(a.out, f"ref_{tok}.png")
        if run(a.comfy, workflow_portrait(brief + portrait_tail, NEG, seed_for(tok), 1024, 1024), p, cid, f"portrait {tok}"):
            refs[tok] = upload(a.comfy, p, f"weftip_ref_{tok}.png")

    # 2) single-character scene driven by the portrait
    ren_scene = ". ".join([cast[0][1], "standing in the scene", a.scene, a.style, "solo, no text"])
    run(a.comfy, workflow_ipscene(ren_scene, NEG, seed_for("scene_ren"), [(refs["ren"], None)], W, H),
        os.path.join(a.out, "scene_ren_single.png"), cid, "single-char scene (Ren via IP-Adapter)")

    # 3) two-character scene, regional IP-Adapter (Ren left, Lou right), one pass
    pad = int(W * 0.02)
    left = (pad, 0, W // 2 - pad, H)
    right = (W // 2, 0, W // 2 - pad, H)
    duo = ". ".join([
        "two figures: a gatekeeper monk on the left and a frail blind elderly master on the right, facing each other",
        a.scene, a.style, "no text"])
    run(a.comfy, workflow_ipscene(duo, NEG, seed_for("scene_duo"),
        [(refs["ren"], left), (refs["lou"], right)], W, H),
        os.path.join(a.out, "scene_duo_regional.png"), cid, "two-char regional IP-Adapter")

if __name__ == "__main__":
    main()
