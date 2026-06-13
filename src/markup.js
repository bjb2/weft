// Markup helpers shared by content. Content builds strings with these; renderers
// decide how to present them. The DOM renderer injects the HTML as-is; the CLI
// renderer strips tags to plain text. Keeping a tiny neutral vocabulary (instead
// of letting content emit arbitrary HTML everywhere) is what lets the same game
// run in a browser and in a terminal test harness unchanged.

export const P = (t) => "<p>" + t + "</p>";
export const SYS = (t) => '<div class="sys">' + t + "</div>";
export const DIV = '<div class="divider">\u2042</div>';
export const B = (t) => "<b>" + t + "</b>";
export const I = (t) => "<i>" + t + "</i>";
export const SMALL = (t) => '<span class="small">' + t + "</span>";

// Plain-text projection for terminal / logs. Block tags become newlines,
// the divider becomes a rule, dialogue becomes "Name: line", inline tags drop.
export function toText(html) {
  return String(html)
    .replace(/<div class="say[^"]*"[^>]*>[\s\S]*?<span class="who">([^<]*)<\/span>[\s\S]*?<span class="bubble">([\s\S]*?)<\/span>[\s\S]*?<\/div>/g, "\n$1: $2\n")
    .replace(/<div class="divider">[^<]*<\/div>/g, "\n   * * *\n")
    .replace(/<\/p>/g, "\n")
    .replace(/<div class="sys">/g, "\n~ ")
    .replace(/<\/div>/g, "\n")
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\u2042/g, "*")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
