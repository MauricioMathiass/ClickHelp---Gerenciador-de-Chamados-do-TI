// Contraste de cor (WCAG) para o texto que fica sobre as cores da marca.

/** Texto escuro e claro possíveis sobre a cor da marca. */
export const ON_BRAND_DARK = "#04131f";
export const ON_BRAND_LIGHT = "#ffffff";

/** Contraste mínimo para texto comum (WCAG AA). */
export const MIN_TEXT_CONTRAST = 4.5;

const parseHex = (hex) => {
  const value = String(hex ?? "")
    .trim()
    .replace(/^#/, "");
  const full = value.length === 3 ? [...value].map((char) => char + char).join("") : value;

  if (!/^[0-9a-f]{6}$/i.test(full)) {
    return null;
  }

  return [0, 2, 4].map((start) => parseInt(full.slice(start, start + 2), 16));
};

const toLinear = (channel) => {
  const value = channel / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

/** Contraste entre duas cores em hexadecimal (1 a 21), ou null se alguma for inválida. */
export const contrastRatio = (first, second) => {
  const a = parseHex(first);
  const b = parseHex(second);

  if (!a || !b) {
    return null;
  }

  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
};

/**
 * Escolhe a cor do texto dos botões da marca. O fundo é um gradiente da cor
 * principal para a secundária, então vale o pior dos dois extremos.
 * Devolve a cor escolhida e o contraste que ela alcança.
 */
export const pickTextOnBrand = (primary, secondary) => {
  const worst = (text) =>
    Math.min(contrastRatio(text, primary) ?? 0, contrastRatio(text, secondary ?? primary) ?? 0);
  const dark = worst(ON_BRAND_DARK);
  const light = worst(ON_BRAND_LIGHT);

  return dark >= light ? { color: ON_BRAND_DARK, ratio: dark } : { color: ON_BRAND_LIGHT, ratio: light };
};

/** "3,2:1", no formato brasileiro. */
export const formatRatio = (ratio) =>
  `${ratio.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}:1`;
