import { describe, expect, it } from "vitest";
import { themeVariablesSchema } from "./types";
import { transitionTheme } from "./theme-transition";

const oldDefaults = { primaryColor: "#111111", baseFontSize: "10pt", fontFamily: "serif" };
const newDefaults = { primaryColor: "#1452c2", baseFontSize: "9pt", fontFamily: "sans-serif" };

describe("template changes", () => {
  it("adopts the new design while preserving only user adjustments", () => {
    const current = { ...oldDefaults, baseFontSize: "12pt", photoLayout: "floating-monolith" as const };
    expect(transitionTheme(current, oldDefaults, newDefaults, true)).toEqual({
      ...newDefaults, baseFontSize: "12pt", photoLayout: "floating-monolith",
    });
    expect(current.fontFamily).toBe("serif");
  });
  it("uses the complete new defaults when preservation is disabled", () => {
    expect(transitionTheme({ primaryColor: "#abcdef" }, oldDefaults, newDefaults, false)).toEqual(newDefaults);
  });
  it("keeps a custom palette's white background when moving to ivory paper", () => {
    expect(transitionTheme(
      { primaryColor: "#1452c2", backgroundColor: "#ffffff" },
      { primaryColor: "#111111", backgroundColor: "#ffffff" },
      { primaryColor: "#3a2415", backgroundColor: "#faf6ed" },
      true,
    ).backgroundColor).toBe("#ffffff");
  });
  it("ignores undefined values from sanitized or partial themes", () => {
    expect(transitionTheme(themeVariablesSchema.parse({ primaryColor: "<unsafe>" }), oldDefaults, newDefaults, true)).toEqual(newDefaults);
  });
});
