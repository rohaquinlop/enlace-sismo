// Convierte tokens CSS Color 4 (oklch) a hex para MapLibre.
// MapLibre no acepta oklch() en las propiedades de estilo; tokens.css sigue
// siendo la única fuente de color y el mapa convierte en tiempo de ejecución.
// Fórmulas según la especificación CSS Color 4 (oklch → oklab → sRGB lineal → sRGB).

const RE_OKLCH = /^oklch\(\s*([\d.]+)%\s+([\d.]+)\s+([\d.]+)\s*\)$/;

/** Convierte "oklch(54% 0.19 256)" a "#rrggbb". Devuelve null si no es oklch. */
export function oklchAHex(valor: string): string | null {
  const m = RE_OKLCH.exec(valor.trim());
  if (!m) return null;
  const L = Number(m[1]) / 100;
  const C = Number(m[2]);
  const H = (Number(m[3]) * Math.PI) / 180;
  const a = C * Math.cos(H);
  const b = C * Math.sin(H);

  // oklab → LMS (al cubo) → sRGB lineal
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;
  const r = 4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3;
  const g = -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3;
  const bl = -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3;

  const gama = (v: number): number => {
    const vv = Math.max(0, Math.min(1, v));
    return vv <= 0.0031308 ? 12.92 * vv : 1.055 * vv ** (1 / 2.4) - 0.055;
  };
  const toHex = (v: number) =>
    Math.round(gama(v) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
}
