export type ContrastStatus = {
  level: "pass" | "warning" | "unknown";
  ratio: number | null;
  message: string;
};

function expandHex(value: string): string | null {
  const hex = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(hex)) return hex.slice(1);
  if (/^#[0-9a-f]{3}$/i.test(hex)) {
    return hex
      .slice(1)
      .split("")
      .map((digit) => `${digit}${digit}`)
      .join("");
  }
  return null;
}

function relativeLuminance(value: string): number | null {
  const hex = expandHex(value);
  if (!hex) return null;

  const channels = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  });

  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(foreground: string, background: string): number | null {
  const fg = relativeLuminance(foreground);
  const bg = relativeLuminance(background);
  if (fg === null || bg === null) return null;

  const lighter = Math.max(fg, bg);
  const darker = Math.min(fg, bg);
  return (lighter + 0.05) / (darker + 0.05);
}

export function getContrastWarning(
  foreground: string,
  background: string,
  threshold = 4.5
): ContrastStatus {
  const ratio = contrastRatio(foreground, background);
  if (ratio === null) {
    return {
      level: "unknown",
      ratio: null,
      message: "仅支持十六进制颜色的自动对比度检查",
    };
  }

  if (ratio < threshold) {
    return {
      level: "warning",
      ratio,
      message: `对比度 ${ratio.toFixed(2)}:1，低于正文建议的 ${threshold}:1`,
    };
  }

  return {
    level: "pass",
    ratio,
    message: `对比度 ${ratio.toFixed(2)}:1`,
  };
}
