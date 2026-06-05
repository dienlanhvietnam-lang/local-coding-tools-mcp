export type TextGravity =
  | "northwest"
  | "north"
  | "northeast"
  | "west"
  | "center"
  | "east"
  | "southwest"
  | "south"
  | "southeast";

export interface TextOverlayOptions {
  text: string;
  width: number;
  height: number;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  backgroundColor?: string;
  padding?: number;
  gravity?: TextGravity;
  maxWidth?: number;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function anchorForGravity(g: TextGravity): { x: string; y: string; anchor: string; baseline: string } {
  const map: Record<TextGravity, { x: string; y: string; anchor: string; baseline: string }> = {
    northwest: { x: "0%", y: "0%", anchor: "start", baseline: "hanging" },
    north: { x: "50%", y: "0%", anchor: "middle", baseline: "hanging" },
    northeast: { x: "100%", y: "0%", anchor: "end", baseline: "hanging" },
    west: { x: "0%", y: "50%", anchor: "start", baseline: "middle" },
    center: { x: "50%", y: "50%", anchor: "middle", baseline: "middle" },
    east: { x: "100%", y: "50%", anchor: "end", baseline: "middle" },
    southwest: { x: "0%", y: "100%", anchor: "start", baseline: "auto" },
    south: { x: "50%", y: "100%", anchor: "middle", baseline: "auto" },
    southeast: { x: "100%", y: "100%", anchor: "end", baseline: "auto" },
  };
  return map[g];
}

export function buildTextOverlaySvg(opts: TextOverlayOptions): Buffer {
  const fontSize = opts.fontSize ?? 32;
  const fontFamily = opts.fontFamily ?? "Arial, sans-serif";
  const color = opts.color ?? "#ffffff";
  const padding = opts.padding ?? 16;
  const gravity = opts.gravity ?? "south";
  const safe = escapeXml(opts.text);
  const anchor = anchorForGravity(gravity);

  const bgRect = opts.backgroundColor
    ? `<rect width="100%" height="100%" fill="${escapeXml(opts.backgroundColor)}" opacity="0.55"/>`
    : "";

  const svg = `<svg width="${opts.width}" height="${opts.height}" xmlns="http://www.w3.org/2000/svg">
  ${bgRect}
  <style>
    .caption { font: ${fontSize}px ${fontFamily}; fill: ${color}; }
  </style>
  <text class="caption" x="${anchor.x}" y="${anchor.y}" text-anchor="${anchor.anchor}" dominant-baseline="${anchor.baseline}" dx="${padding}" dy="-${padding}">${safe}</text>
</svg>`;

  return Buffer.from(svg);
}
