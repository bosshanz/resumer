const clampPercent = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : fallback;

/** 裁切焦点：横向默认居中、纵向默认 35%（偏上，落在面部）；完整显示时居中。 */
export function photoObjectPosition(vars: { photoFit?: string; photoPosition?: number; photoPositionX?: number }): string {
  if (vars.photoFit === "contain") return "50% 50%";
  return `${clampPercent(vars.photoPositionX, 50)}% ${clampPercent(vars.photoPosition, 35)}%`;
}
