// Art-style presets. Each preset bundles BOTH an image-generation descriptor
// (used to build prompts) AND a UI palette (CSS variables), so a game's
// illustrations and its interface share one coherent look chosen once at
// onboarding via def.meta.art.style. Add presets freely; a game may also pass a
// custom palette/descriptor inline in def.meta.art.

export const STYLES = {
  "ink-wash": {
    descriptor: "Chinese ink-wash (shuimo) painting on deep indigo night paper, minimal and atmospheric, cool moonlit blues with a single warm metallic-gold accent, wuxia fantasy",
    framing: "wide cinematic banner, lots of negative space, no text",
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
  pixel: {
    descriptor: "16-bit pixel-art scene, limited palette, dithering, crisp pixels, retro JRPG dungeon aesthetic, dramatic torchlight",
    framing: "side-on diorama, chunky pixels, no text",
    palette: { "--bg": "#0d0e1b", "--bg2": "#1a1c2e", "--panel": "#161827", "--ink": "#c7d0e0", "--dim": "#6f7aa0", "--accent": "#5fd68a", "--accent2": "#2f8f57", "--good": "#5fd68a", "--bad": "#e05f6a", "--cool": "#5f9fd6", "--line": "#262a44" },
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
