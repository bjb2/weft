#!/usr/bin/env python3
"""Generate weft game art via a local ComfyUI server (SD 3.5 Medium GGUF).

Reads a game's art/prompts.json, builds the SD3.5 workflow per slot, posts it to
the ComfyUI HTTP API, and writes assets/<slot>.png. Deterministic seed per slot.

  python gen.py --game <gameDir> --slots pass:1216x832 ren:1024x1024 ...
  python gen.py --game <gameDir> --all          # every slot (pfps square, scenes 3:2)

No third-party deps (urllib/json only). Requires a ComfyUI server at --comfy.
"""
import argparse, json, os, time, urllib.request, urllib.parse, uuid, hashlib

NEG = "text, words, letters, watermark, signature, caption, logo, blurry, lowres, jpeg artifacts, deformed, extra limbs, bad anatomy, ugly"

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
        pid = post(a.comfy, workflow(prompts[slot], NEG, seed_for(slot), w, h, a.steps), cid)
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
