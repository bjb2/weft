// Art-style presets. Each preset bundles BOTH an image-generation descriptor
// (used to build prompts) AND a UI palette (CSS variables), so a game's
// illustrations and its interface share one coherent look chosen once at
// onboarding via def.meta.art.style. Add presets freely; a game may also pass a
// custom palette/descriptor inline in def.meta.art.

export const STYLES = {
  "ink-wash": {
    descriptor: "atmospheric cinematic wuxia illustration with soft ink-wash texture and misty depth, deep moonlit indigo-blue palette with a single warm metallic-gold accent, painterly digital concept art, evocative and minimal",
    framing: "wide cinematic banner, lots of negative space, no text, no signature, no seal, no calligraphy, no border",
    palette: { "--bg": "#0a0d14", "--bg2": "#141b2c", "--panel": "#121826", "--ink": "#cfd6e4", "--dim": "#7d889e", "--accent": "#e8c15a", "--accent2": "#a8862e", "--good": "#58b890", "--bad": "#e0606a", "--cool": "#7ea7d8", "--line": "#242e45" },
  },
  // Illustrious/SDXL-tuned wuxia. Same indigo/gold palette as ink-wash (UI is
  // unchanged) but an anime-cel descriptor that an SDXL model renders cleanly,
  // instead of the painterly SD3.5 wording that Illustrious turns sketchy.
  wuxia: {
    descriptor: "anime wuxia illustration, ancient chinese xianxia setting, flowing hanfu robes, soft painterly cel shading, cinematic lighting, deep moonlit indigo-blue palette with warm metallic-gold accents, atmospheric mist, detailed and elegant",
    framing: "cinematic key visual, atmospheric composition, no text, no signature, no watermark, no title, no logo, no seal, no calligraphy, no border",
    palette: { "--bg": "#0a0d14", "--bg2": "#141b2c", "--panel": "#121826", "--ink": "#cfd6e4", "--dim": "#7d889e", "--accent": "#e8c15a", "--accent2": "#a8862e", "--good": "#58b890", "--bad": "#e0606a", "--cool": "#7ea7d8", "--line": "#242e45" },
  },
  noir: {
    descriptor: "high-contrast black-and-white film-noir illustration, deep shadows and hard key light, rain and smoke, 1940s detective mood, a single desaturated crimson accent",
    framing: "cinematic 2.39:1 frame, dramatic chiaroscuro, no text",
    palette: { "--bg": "#0b0b0d", "--bg2": "#17171c", "--panel": "#141417", "--ink": "#d8d8de", "--dim": "#8a8a93", "--accent": "#c0444c", "--accent2": "#7d2b30", "--good": "#9bb0a0", "--bad": "#c0444c", "--cool": "#8a93a8", "--line": "#26262d" },
  },
  storybook: {
    descriptor: "warm storybook watercolor and ink, soft edges, golden-hour light, gentle whimsy, hand-painted picture-book texture on cream paper",
    framing: "landscape illustration plate, soft vignette, no text",
    palette: { "--bg": "#1c1812", "--bg2": "#2a241a", "--panel": "#241f17", "--ink": "#efe6d4", "--dim": "#a99c84", "--accent": "#e0a85a", "--accent2": "#b07d3a", "--good": "#7fae6a", "--bad": "#d2705a", "--cool": "#6fa5a0", "--line": "#3a3326" },
  },
  comic: {
    descriptor: "bold modern comic-book / graphic-novel illustration, confident clean ink linework, flat saturated colors, subtle halftone shading, expressive cartoon characters, dynamic energy",
    framing: "single dramatic panel, strong composition, no text, no speech bubbles, no captions, no panel borders",
    palette: { "--bg": "#12131c", "--bg2": "#1d1f2e", "--panel": "#181a26", "--ink": "#e8e6f0", "--dim": "#8b90a8", "--accent": "#ffd23f", "--accent2": "#e0902e", "--good": "#06d6a0", "--bad": "#ef476f", "--cool": "#4cc9f0", "--line": "#2a2d40" },
  },
  flat: {
    descriptor: "clean modern flat-vector editorial illustration, bold simple geometric shapes, smooth subtle gradients, tasteful limited palette, generous negative space, minimal detail",
    framing: "landscape editorial illustration, no text, no logos",
    palette: { "--bg": "#0f1419", "--bg2": "#172029", "--panel": "#141c24", "--ink": "#e4ebf0", "--dim": "#7e8a98", "--accent": "#f4a259", "--accent2": "#bb6b34", "--good": "#5fb88f", "--bad": "#e06a6a", "--cool": "#5b9bd5", "--line": "#22303b" },
  },
  anime: {
    descriptor: "polished modern anime key-visual illustration, clean cel shading, vivid colors, soft rim light, expressive characters, detailed background",
    framing: "cinematic key visual, no text, no captions",
    palette: { "--bg": "#0e1018", "--bg2": "#1a1d2e", "--panel": "#161a28", "--ink": "#e9ecf6", "--dim": "#888fa6", "--accent": "#ff8fb1", "--accent2": "#c75f86", "--good": "#6bd6a8", "--bad": "#ef5d6c", "--cool": "#6cc4f0", "--line": "#262a3e" },
  },
  oil: {
    descriptor: "moody oil painting, thick impasto brushwork, romantic-era landscape drama, rich earthy palette with one luminous highlight, museum-grade chiaroscuro",
    framing: "framed canvas composition, painterly, no text",
    palette: { "--bg": "#100c0a", "--bg2": "#211913", "--panel": "#1b1410", "--ink": "#e7dccb", "--dim": "#9c8b78", "--accent": "#d99a4e", "--accent2": "#9c6a2e", "--good": "#8aa86a", "--bad": "#c75a4a", "--cool": "#6f93a8", "--line": "#332720" },
  },
};



export function resolveStyle(art) {
  if (!art) return null;
  const preset = STYLES[art.style] || null;
  const descriptor = art.descriptor || preset?.descriptor || "";
  const framing = art.framing || preset?.framing || "no text";
  const palette = { ...(preset?.palette || {}), ...(art.palette || {}) };
  return { descriptor, framing, palette };
}
