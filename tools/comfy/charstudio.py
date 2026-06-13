#!/usr/bin/env python3
"""weft character studio — Stage 1: bootstrap a SD3.5-Medium LoRA training set
from a text brief, with zero manual curation.

Pipeline (pure HTTP against a running ComfyUI; no torch here, harness-safe):

  brief --txt2img--> a deterministic HERO frame (upper body, plain background)
       --img2img---> N on-model variations: the hero re-painted across a fixed
                     sweep of expression / lighting / framing prompts at a low
                     denoise, so identity holds and no human pruning is needed.

Each frame is written with a deterministic caption (we authored the sweep, so we
already know each frame's view — no captioner needed). The result is a kohya /
OneTrainer-ready folder:  <out>/<token>/{img.png, img.txt, ...}

Stage 2 (your terminal): train the LoRA on that folder, drop the .safetensors in
ComfyUI/models/loras, and reference it from the character's cast entry.

Usage:
  python charstudio.py --brief "a lean gatekeeper monk leaning on a bamboo staff" \
      --token sb_ren --style "anime wuxia illustration, ..." --out art/lora --n 24
"""
import argparse, json, os, time, urllib.request, urllib.parse, uuid, hashlib, io

NEG = ("text, words, letters, watermark, signature, caption, logo, title, label, "
       "red seal, artist seal, stamp, calligraphy, chinese characters, japanese text, kanji, hanzi, "
       "border, frame, picture frame, "
       "blurry, lowres, jpeg artifacts, deformed, extra limbs, bad anatomy, ugly")

# --- SD3.5 Medium graph fragments (same model as gen.py) -------------------
def _loaders(prompt, neg):
    return {
        "u": {"class_type": "UnetLoaderGGUF", "inputs": {"unet_name": "sd3.5_medium-q8_0.gguf"}},
        "c": {"class_type": "TripleCLIPLoader", "inputs": {
                 "clip_name1": "clip_g.safetensors", "clip_name2": "clip_l.safetensors",
                 "clip_name3": "t5xxl_bf16.safetensors"}},
        "v": {"class_type": "VAELoader", "inputs": {"vae_name": "sd3.5_vae.safetensors"}},
        "p": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["c", 0], "text": prompt}},
        "n": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["c", 0], "text": neg}},
    }

def _sampler(latent_ref, seed, denoise, steps, cfg, model=None):
    return {"class_type": "KSampler", "inputs": {
        "model": model or ["u", 0], "positive": ["p", 0], "negative": ["n", 0], "latent_image": latent_ref,
        "seed": seed, "steps": steps, "cfg": cfg,
        "sampler_name": "dpmpp_2m", "scheduler": "sgm_uniform", "denoise": denoise}}

def _with_lora(g, lora, strength):
    """Route the diffusion model through a model-only LoRA, returning its ref.
    One LoRA per pass is the whole point: it's the only identity active, so a
    multi-character scene built from several single-LoRA passes never bleeds."""
    if not lora:
        return None
    g["lr"] = {"class_type": "LoraLoaderModelOnly",
               "inputs": {"model": ["u", 0], "lora_name": lora, "strength_model": strength}}
    return ["lr", 0]

def workflow_inpaint(init_name, prompt, neg, seed, denoise, region, W, H,
                     steps=28, cfg=4.5, lora=None, lora_strength=0.9, feather=96):
    """Repaint one rectangular region of an existing image. The region mask is
    built from ComfyUI core nodes (no external mask file): a black full-canvas
    SolidMask with a white SolidMask composited in at the region, feathered so
    the painted figure blends into the scene."""
    x, y, rw, rh = region
    g = _loaders(prompt, neg)
    g["i"] = {"class_type": "LoadImage", "inputs": {"image": init_name}}
    g["e"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["i", 0], "vae": ["v", 0]}}
    g["mb"] = {"class_type": "SolidMask", "inputs": {"value": 0.0, "width": W, "height": H}}
    g["mr"] = {"class_type": "SolidMask", "inputs": {"value": 1.0, "width": rw, "height": rh}}
    g["mc"] = {"class_type": "MaskComposite", "inputs": {"destination": ["mb", 0], "source": ["mr", 0], "x": x, "y": y, "operation": "add"}}
    g["mf"] = {"class_type": "FeatherMask", "inputs": {"mask": ["mc", 0], "left": feather, "top": feather, "right": feather, "bottom": feather}}
    g["sm"] = {"class_type": "SetLatentNoiseMask", "inputs": {"samples": ["e", 0], "mask": ["mf", 0]}}
    g["k"] = _sampler(["sm", 0], seed, denoise, steps, cfg, model=_with_lora(g, lora, lora_strength))
    g["d"] = {"class_type": "VAEDecode", "inputs": {"samples": ["k", 0], "vae": ["v", 0]}}
    g["s"] = {"class_type": "SaveImage", "inputs": {"images": ["d", 0], "filename_prefix": "weft_cs"}}
    return g

def workflow_txt2img(prompt, neg, seed, w, h, steps=28, cfg=4.5):
    g = _loaders(prompt, neg)
    g["l"] = {"class_type": "EmptySD3LatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}}
    g["k"] = _sampler(["l", 0], seed, 1.0, steps, cfg)
    g["d"] = {"class_type": "VAEDecode", "inputs": {"samples": ["k", 0], "vae": ["v", 0]}}
    g["s"] = {"class_type": "SaveImage", "inputs": {"images": ["d", 0], "filename_prefix": "weft_cs"}}
    return g

def workflow_img2img(init_name, prompt, neg, seed, denoise, steps=28, cfg=4.5):
    g = _loaders(prompt, neg)
    g["i"] = {"class_type": "LoadImage", "inputs": {"image": init_name}}
    g["e"] = {"class_type": "VAEEncode", "inputs": {"pixels": ["i", 0], "vae": ["v", 0]}}
    g["k"] = _sampler(["e", 0], seed, denoise, steps, cfg)
    g["d"] = {"class_type": "VAEDecode", "inputs": {"samples": ["k", 0], "vae": ["v", 0]}}
    g["s"] = {"class_type": "SaveImage", "inputs": {"images": ["d", 0], "filename_prefix": "weft_cs"}}
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
            return h[pid]
        time.sleep(2)
    raise TimeoutError("generation timed out")

def first_image(res):
    for node in res.get("outputs", {}).values():
        for im in node.get("images", []):
            return im
    return None

def fetch(comfy, img, out):
    q = urllib.parse.urlencode({"filename": img["filename"], "subfolder": img.get("subfolder", ""), "type": img.get("type", "output")})
    data = urllib.request.urlopen(comfy + "/view?" + q, timeout=60).read()
    with open(out, "wb") as f:
        f.write(data)
    return out

def upload_image(comfy, path, name):
    with open(path, "rb") as f:
        data = f.read()
    boundary = "----weftcs" + uuid.uuid4().hex
    buf = io.BytesIO()
    w = lambda s: buf.write(s if isinstance(s, bytes) else s.encode())
    w(f"--{boundary}\r\n")
    w(f'Content-Disposition: form-data; name="image"; filename="{name}"\r\n')
    w("Content-Type: image/png\r\n\r\n"); w(data); w("\r\n")
    w(f"--{boundary}\r\n")
    w('Content-Disposition: form-data; name="overwrite"\r\n\r\n'); w("true\r\n")
    w(f"--{boundary}--\r\n")
    req = urllib.request.Request(comfy + "/upload/image", buf.getvalue(),
                                 {"Content-Type": f"multipart/form-data; boundary={boundary}"})
    return json.load(urllib.request.urlopen(req, timeout=30))["name"]

def seed_for(s):
    return int(hashlib.sha1(s.encode()).hexdigest()[:8], 16)

# --- variation sweeps ------------------------------------------------------
# SWEEP drives img2img off the hero: composition is preserved, so these vary
# expression / lighting / sub-angle only (identity stays tight, no curation).
SWEEP = [
    ("front",        "front view, looking at viewer, neutral expression, soft even light"),
    ("threequarter", "three-quarter view, calm expression, soft side light"),
    ("profile",      "side profile view, looking to the side"),
    ("downcast",     "eyes lowered, pensive, gentle top light"),
    ("stern",        "stern serious expression, hard side light"),
    ("slight_smile", "faint smile, warm light"),
    ("looking_up",   "chin lifted slightly, looking up, rim light"),
    ("shadowed",     "dramatic low-key lighting, half in shadow"),
    ("bright",       "bright high-key lighting, clear face"),
    ("backlit",      "backlit, soft glow around the hair"),
    ("over_shoulder","glancing back over the shoulder"),
    ("tired",        "weary tired expression, dim light"),
]

# REFRAME_SWEEP drives fresh txt2img from the identity brief: this is where gross
# pose / framing variety comes from (full body, close-up, sitting, from behind) —
# the variety img2img physically cannot produce. Identity recurs from the detailed
# brief; expect mild drift between frames, which a LoRA averages out.
REFRAME_SWEEP = [
    ("fullbody",     "full body shot, standing, full figure from head to toe"),
    ("closeup",      "close-up of the face, tight portrait crop"),
    ("profile_full", "full body, side profile, standing"),
    ("sitting",      "sitting down, relaxed, full body"),
    ("from_behind",  "back view, seen from behind, head turned to the side"),
    ("walking",      "walking forward, dynamic full body pose"),
    ("kneeling",     "kneeling on one knee, full body"),
    ("arms_crossed", "arms crossed, confident stance, upper body"),
]

# Character-focus lock: a plain background and single subject so the LoRA learns
# the CHARACTER, not a scene. This also counters scene-y style words (mist, moon)
# that otherwise paint a full background behind the reference.
DS_TAIL = "solo, single character, plain solid grey background, character reference sheet, no scenery, no landscape"
DS_NEG = NEG + ", scenery, landscape, background, moon, sky, trees, buildings, multiple people, two characters, extra person, crowd"

def compose_ds(brief, style, *parts):
    return ". ".join([brief, *[p for p in parts if p], DS_TAIL, style, "no text"])

def run_dataset(a):
    cid = uuid.uuid4().hex
    dst = os.path.join(a.out, a.token)
    os.makedirs(dst, exist_ok=True)

    # 1) HERO — clean upper-body, plain background; the img2img anchor.
    hero_prompt = compose_ds(a.brief, a.style, "upper body portrait, front view, neutral expression, soft even light")
    t0 = time.time()
    res = wait(a.comfy, post(a.comfy, workflow_txt2img(hero_prompt, DS_NEG, seed_for(a.token), a.w, a.h, a.steps), cid))
    im = first_image(res)
    if not im:
        print("FAIL: hero produced no image"); return
    hero_path = os.path.join(dst, "hero.png")
    fetch(a.comfy, im, hero_path)
    hero_name = upload_image(a.comfy, hero_path, f"weftcs_{a.token}_hero.png")
    print(f"  hero -> {hero_path}  ({time.time()-t0:.0f}s)")

    kept = 0
    def emit(stem, frag):
        nonlocal kept
        with open(os.path.join(dst, stem + ".txt"), "w", encoding="utf-8") as f:
            f.write(f"{a.token}, {a.brief}, {frag}")
        kept += 1

    # 2) RIFFS — img2img off the hero: expression/lighting variety, identity tight.
    for idx in range(a.riffs):
        tag, frag = SWEEP[idx % len(SWEEP)]
        seed = seed_for(f"{a.token}:riff:{idx}:{tag}")
        t0 = time.time()
        res = wait(a.comfy, post(a.comfy, workflow_img2img(hero_name, compose_ds(a.brief, a.style, frag), DS_NEG, seed, a.denoise, a.steps), cid))
        im = first_image(res)
        if not im:
            print(f"  FAIL riff {idx} {tag}"); continue
        stem = f"{a.token}_r{idx:02d}_{tag}"
        fetch(a.comfy, im, os.path.join(dst, stem + ".png")); emit(stem, frag)
        print(f"  riff {stem}  ({time.time()-t0:.0f}s)")

    # 3) REFRAMES — fresh txt2img for the gross pose/framing variety img2img can't
    #    give. Slightly higher cfg keeps the identity brief assertive against drift.
    for idx in range(a.reframes):
        tag, frag = REFRAME_SWEEP[idx % len(REFRAME_SWEEP)]
        seed = seed_for(f"{a.token}:reframe:{idx}:{tag}")
        t0 = time.time()
        res = wait(a.comfy, post(a.comfy, workflow_txt2img(compose_ds(a.brief, a.style, frag), DS_NEG, seed, a.w, a.h, a.steps, cfg=5.0), cid))
        im = first_image(res)
        if not im:
            print(f"  FAIL reframe {idx} {tag}"); continue
        stem = f"{a.token}_f{idx:02d}_{tag}"
        fetch(a.comfy, im, os.path.join(dst, stem + ".png")); emit(stem, frag)
        print(f"  reframe {stem}  ({time.time()-t0:.0f}s)")

    print(f"\n  hero + {kept} frames ({a.riffs} riffs + {a.reframes} reframes) -> {dst}")

def regions_for(n, W, H):
    """Deterministic figure boxes from cast count: 1=center, 2=L/R, 3=thirds.
    Each box is a tall slot in the lower portion of the banner."""
    top = int(H * 0.16); bh = H - top - int(H * 0.03)
    if n <= 1:
        bw = int(W * 0.5); return [((W - bw) // 2, top, bw, bh)]
    colw = W // n; bw = int(colw * 0.86)
    return [(i * colw + (colw - bw) // 2, top, bw, bh) for i in range(n)]

def run_composite(a):
    """Build a multi-character scene with zero feature-bleed: render the empty
    background, then inpaint each character into their own region in a separate
    pass with only that character's LoRA loaded. Each pass chains on the running
    composite so later figures see the ones already placed."""
    cid = uuid.uuid4().hex
    out_dir = os.path.dirname(a.out)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    W, H = a.w, a.h

    # 1) BACKGROUND — establishing shot, no figures.
    bg_prompt = ". ".join([a.bg, "wide establishing shot, empty, no people, no figures", a.style, "no text"])
    t0 = time.time()
    res = wait(a.comfy, post(a.comfy, workflow_txt2img(bg_prompt, NEG, seed_for("bg:" + a.bg), W, H, a.steps), cid))
    im = first_image(res)
    if not im:
        print("FAIL: background produced no image"); return
    fetch(a.comfy, im, a.out)
    print(f"  bg -> {a.out}  ({time.time()-t0:.0f}s)")

    # 2) CHARACTERS — one inpaint pass each, one LoRA at a time.
    regs = regions_for(len(a.briefs), W, H)
    for i, (brief, reg) in enumerate(zip(a.briefs, regs)):
        up = upload_image(a.comfy, a.out, f"weftcs_scene_{i}_{uuid.uuid4().hex[:6]}.png")
        lora = a.loras[i] if i < len(a.loras) and a.loras[i] != "-" else None
        prompt = ". ".join([brief, "full body, standing in the scene, consistent lighting and scale", a.style, "no text"])
        seed = seed_for(f"scene:{i}:{brief}")
        t0 = time.time()
        res = wait(a.comfy, post(a.comfy, workflow_inpaint(up, prompt, NEG, seed, a.denoise, reg, W, H, a.steps, lora=lora), cid))
        im = first_image(res)
        if not im:
            print(f"  FAIL char {i}"); continue
        fetch(a.comfy, im, a.out)
        print(f"  char {i} {('+lora ' + lora) if lora else '(prompt-only)'} region={reg}  ({time.time()-t0:.0f}s)")

    print(f"\n  composite -> {a.out}")

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=["dataset", "composite"], default="dataset")
    ap.add_argument("--comfy", default="http://127.0.0.1:8188")
    ap.add_argument("--style", default="", help="style descriptor appended to every prompt")
    ap.add_argument("--steps", type=int, default=28)
    ap.add_argument("--out", help="dataset root (dataset mode) or output PNG (composite mode)")
    ap.add_argument("--w", type=int, default=1024)
    ap.add_argument("--h", type=int, default=1024)
    ap.add_argument("--denoise", type=float, default=0.5)
    # dataset mode
    ap.add_argument("--brief", help="character description (dataset mode)")
    ap.add_argument("--token", help="LoRA trigger token, e.g. sb_ren (dataset mode)")
    ap.add_argument("--riffs", type=int, default=12, help="img2img variations off the hero (dataset mode)")
    ap.add_argument("--reframes", type=int, default=8, help="txt2img pose/framing reframes (dataset mode)")
    # composite mode
    ap.add_argument("--bg", default="", help="background scene description (composite mode)")
    ap.add_argument("--briefs", nargs="*", default=[], help="one description per character (composite mode)")
    ap.add_argument("--loras", nargs="*", default=[], help="parallel LoRA names; '-' or omit for prompt-only")
    a = ap.parse_args()

    if a.mode == "dataset":
        if not (a.brief and a.token and a.out):
            ap.error("dataset mode needs --brief --token --out")
        run_dataset(a)
    else:
        if not (a.bg and a.briefs and a.out):
            ap.error("composite mode needs --bg --briefs --out")
        run_composite(a)

if __name__ == "__main__":
    main()
