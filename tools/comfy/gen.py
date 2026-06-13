#!/usr/bin/env python3
"""Generate weft game art via a local ComfyUI server (SD 3.5 Medium GGUF).

Reads a game's art/prompts.json, builds the SD3.5 workflow per slot, posts it to
the ComfyUI HTTP API, and writes assets/<slot>.png. Deterministic seed per slot.

  python gen.py --game <gameDir> --slots pass:1216x832 ren:1024x1024 ...
  python gen.py --game <gameDir> --all          # every slot (pfps square, scenes 3:2)

No third-party deps (urllib/json only). Requires a ComfyUI server at --comfy.
"""
import argparse, json, os, time, urllib.request, urllib.parse, uuid, hashlib

NEG = ("text, words, letters, watermark, signature, caption, logo, title, label, "
       "red seal, artist seal, stamp, calligraphy, chinese characters, japanese text, kanji, hanzi, "
       "border, frame, picture frame, "
       "blurry, lowres, jpeg artifacts, deformed, extra limbs, bad anatomy, ugly, "
       "bad hands, malformed hands, deformed hands, extra fingers, missing fingers, fused fingers, mangled hands")

# Illustrious-XL (SDXL) path. SDXL responds to quality tags; keep a tight booru-ish
# negative. Used by --model illustrious (the only path that can do IP-Adapter).
SDXL_POS = "masterpiece, best quality, highly detailed, "
SDXL_NEG = ("(text:1.3), (signature:1.4), (red seal:1.6), (artist seal:1.6), (stamp:1.5), (watermark:1.4), (logo:1.3), "
       "english text, chinese text, japanese text, kanji, hanzi, letters, words, artist name, username, title, caption, label, calligraphy, web address, "
       "lowres, worst quality, low quality, jpeg artifacts, blurry, "
       "bad anatomy, bad hands, missing fingers, extra digits, deformed, extra limbs, ugly, "
       "border, frame, picture frame, speech bubble")

def workflow(prompt, neg, seed, w, h, steps=28, cfg=4.5):
    return {
        "u":  {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": "sd3.5_medium-q8_0.gguf"}},
        "c":  {"class_type": "TripleCLIPLoader", "inputs": {
                 "clip_name1": "clip_g.safetensors", "clip_name2": "clip_l.safetensors",
                 "clip_name3": "t5xxl_bf16.safetensors"}},
        "v":  {"class_type": "VAELoader", "inputs": {"vae_name": "sd3.5_vae.safetensors"}},
        "p":  {"class_type": "CLIPTextEncode", "inputs": {"clip": ["c", 0], "text": prompt}},
        "n":  {"class_type": "CLIPTextEncode", "inputs": {"clip": ["c", 0], "text": neg}},
        "l":  {"class_type": "EmptySD3LatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}},
        "k":  {"class_type": "KSampler", "inputs": {
                 "model": ["u", 0], "positive": ["p", 0], "negative": ["n", 0], "latent_image": ["l", 0],
                 "seed": seed, "steps": steps, "cfg": cfg,
                 "sampler_name": "dpmpp_2m", "scheduler": "sgm_uniform", "denoise": 1.0}},
        "d":  {"class_type": "VAEDecode", "inputs": {"samples": ["k", 0], "vae": ["v", 0]}},
        "s":  {"class_type": "SaveImage", "inputs": {"images": ["d", 0], "filename_prefix": "weft"}},
    }

def workflow_sdxl(prompt, neg, seed, w, h, steps=30, cfg=6.0):
    return {
        "m":  {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": "Illustrious-XL-v1.0.safetensors"}},
        "p":  {"class_type": "CLIPTextEncode", "inputs": {"clip": ["m", 1], "text": SDXL_POS + prompt}},
        "n":  {"class_type": "CLIPTextEncode", "inputs": {"clip": ["m", 1], "text": neg}},
        "l":  {"class_type": "EmptyLatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}},
        "k":  {"class_type": "KSampler", "inputs": {
                 "model": ["m", 0], "positive": ["p", 0], "negative": ["n", 0], "latent_image": ["l", 0],
                 "seed": seed, "steps": steps, "cfg": cfg,
                 "sampler_name": "dpmpp_2m", "scheduler": "karras", "denoise": 1.0}},
        "d":  {"class_type": "VAEDecode", "inputs": {"samples": ["k", 0], "vae": ["m", 2]}},
        "s":  {"class_type": "SaveImage", "inputs": {"images": ["d", 0], "filename_prefix": "weft"}},
    }

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
            return h[pid]
        time.sleep(2)
    raise TimeoutError("generation timed out")

def fetch(comfy, img, out):
    q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img.get("type", "output")})
    data = urllib.request.urlopen(comfy + "/view?" + q, timeout=60).read()
    with open(out, "wb") as f:
        f.write(data)

def seed_for(slot):
    return int(hashlib.sha1(slot.encode()).hexdigest()[:8], 16)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--game", required=True)
    ap.add_argument("--comfy", default="http://127.0.0.1:8188")
    ap.add_argument("--slots", nargs="*", default=[])
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--steps", type=int, default=28)
    ap.add_argument("--model", choices=["sd35", "illustrious"], default="sd35")
    ap.add_argument("--seed", type=int, default=None, help="override the deterministic per-slot seed (re-roll a slot)")
    a = ap.parse_args()

    prompts = json.load(open(os.path.join(a.game, "art", "prompts.json")))
    cast = set()
    try:
        gj = open(os.path.join(a.game, "game.js")).read()
        # crude: pfp asset names appear as pfp: "name"
        import re
        cast = set(re.findall(r'pfp:\s*"([^"]+)"', gj))
    except Exception:
        pass

    jobs = []
    if a.all:
        for slot in prompts:
            w, h = (1024, 1024) if slot in cast else (1216, 832)
            jobs.append((slot, w, h))
    for spec in a.slots:
        if ":" in spec:
            slot, dim = spec.split(":"); w, h = map(int, dim.split("x"))
        else:
            slot = spec; w, h = (1024, 1024) if slot in cast else (1216, 832)
        jobs.append((slot, w, h))

    cid = uuid.uuid4().hex
    os.makedirs(os.path.join(a.game, "assets"), exist_ok=True)
    for slot, w, h in jobs:
        if slot not in prompts:
            print(f"  SKIP {slot}: not in prompts.json"); continue
        out = os.path.join(a.game, "assets", slot + ".png")
        t0 = time.time()
        seed = a.seed if a.seed is not None else seed_for(slot)
        wf = (workflow_sdxl(prompts[slot], SDXL_NEG, seed, w, h, a.steps)
              if a.model == "illustrious" else
              workflow(prompts[slot], NEG, seed, w, h, a.steps))
        pid = post(a.comfy, wf, cid)
        res = wait(a.comfy, pid)
        imgs = []
        for node in res.get("outputs", {}).values():
            imgs += node.get("images", [])
        if not imgs:
            print(f"  FAIL {slot}: no image ({res.get('status')})"); continue
        fetch(a.comfy, imgs[0], out)
        print(f"  ok {slot} {w}x{h} -> assets/{slot}.png  ({time.time()-t0:.0f}s)")

if __name__ == "__main__":
    main()
