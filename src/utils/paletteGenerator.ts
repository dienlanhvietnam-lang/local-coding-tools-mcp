export interface PaletteColor {
  name: string;
  hex: string;
}

export interface GeneratedPalette {
  light: PaletteColor[];
  dark: PaletteColor[];
  cssVariables: string;
  tailwindExtend: string;
}

function hexToHsl(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  let sat = 0;
  const lum = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = lum > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        hue = ((b - r) / d + 2) / 6;
        break;
      default:
        hue = ((r - g) / d + 4) / 6;
    }
  }
  return [hue * 360, sat * 100, lum * 100];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function generatePaletteFromSeed(seedHex: string): GeneratedPalette {
  const [h] = hexToHsl(seedHex);
  const light: PaletteColor[] = [
    { name: "primary", hex: seedHex },
    { name: "primary-hover", hex: hslToHex(h, 70, 45) },
    { name: "surface", hex: "#ffffff" },
    { name: "surface-muted", hex: hslToHex(h, 20, 96) },
    { name: "border", hex: hslToHex(h, 15, 85) },
    { name: "text", hex: hslToHex(h, 25, 15) },
    { name: "text-muted", hex: hslToHex(h, 10, 45) },
    { name: "success", hex: "#16a34a" },
    { name: "warning", hex: "#d97706" },
    { name: "error", hex: "#dc2626" },
  ];
  const dark: PaletteColor[] = [
    { name: "primary", hex: hslToHex(h, 75, 65) },
    { name: "primary-hover", hex: hslToHex(h, 80, 72) },
    { name: "surface", hex: hslToHex(h, 20, 10) },
    { name: "surface-muted", hex: hslToHex(h, 15, 16) },
    { name: "border", hex: hslToHex(h, 12, 24) },
    { name: "text", hex: hslToHex(h, 10, 95) },
    { name: "text-muted", hex: hslToHex(h, 8, 65) },
    { name: "success", hex: "#22c55e" },
    { name: "warning", hex: "#f59e0b" },
    { name: "error", hex: "#ef4444" },
  ];

  const cssLines = [
    ":root {",
    ...light.map((c) => `  --color-${c.name}: ${c.hex};`),
    "}",
    ".dark, [data-theme='dark'] {",
    ...dark.map((c) => `  --color-${c.name}: ${c.hex};`),
    "}",
  ];

  const twColors = Object.fromEntries(light.map((c) => [c.name, c.hex]));
  const tailwindExtend = JSON.stringify({ theme: { extend: { colors: twColors } } }, null, 2);

  return {
    light,
    dark,
    cssVariables: cssLines.join("\n"),
    tailwindExtend,
  };
}
