import type { ThemeVariables } from "./types";

/** Carry user overrides across layouts without copying the old template defaults. */
export function transitionTheme(
  current: ThemeVariables,
  previousDefaults: ThemeVariables,
  nextDefaults: ThemeVariables,
  preserveAdjustments: boolean,
): ThemeVariables {
  if (!preserveAdjustments) return { ...nextDefaults };
  const overrides = Object.fromEntries(
    Object.entries(current).filter(([key, value]) => value !== undefined && value !== previousDefaults[key]),
  );
  // A palette is one choice: keep its paper/text colors together with its
  // accent, even when one of them happens to match the previous defaults.
  for (const group of [
    ["primaryColor", "secondaryColor", "backgroundColor", "textColor"],
    ["baseFontSize", "lineHeight"],
    ["marginTop", "marginBottom", "marginLeft", "marginRight"],
  ]) {
    if (!group.some((key) => key in overrides)) continue;
    for (const key of group) {
      const value = current[key] ?? previousDefaults[key];
      if (value !== undefined) overrides[key] = value;
    }
  }
  return { ...nextDefaults, ...overrides };
}
