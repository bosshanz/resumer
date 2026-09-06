import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { templates, resolveTemplateSettings } from "./index";
import { themeVariablesSchema } from "../types";

describe("theme portrait compositions", () => {
  it.each(templates)("$name includes a portrait once and leaves no slot when absent", template => {
    const props = { frontmatter: { name: "Alexandra Catherine Montgomery", contact: { email: "alex@example.com" } }, body: "## Experience\n\n- Complete record", themeVariables: { photoLayout: "floating-monolith" as const } };
    const photo = renderToStaticMarkup(React.createElement(template.component, { ...props, photo: "data:image/png;base64,test" }));
    expect(photo.match(/class="resume-photo"/g)).toHaveLength(1);
    expect(photo).toContain("Alexandra Catherine Montgomery");
    expect(photo).toContain("alex@example.com");
    if (template.id === "editorial") expect(photo.indexOf('class="folio-photo"')).toBeGreaterThan(photo.indexOf('class="folio-rail"'));
    const none = renderToStaticMarkup(React.createElement(template.component, props));
    expect(none).not.toContain('class="folio-photo"');
    expect(none).not.toContain("folio-portrait-large");
    expect(none).not.toContain("folio-with-photo");
  });
  it("validates fit and focal position, preserving controls when changing themes", () => {
    expect(themeVariablesSchema.parse({ photoFit: "invalid", photoPosition: 200 })).toMatchObject({ photoFit: undefined, photoPosition: undefined });
    const theme = resolveTemplateSettings("minimal", { photoFit: "contain", photoPosition: 70 }).themeVariables;
    expect(theme.photoFit).toBe("contain");
    expect(theme.photoPosition).toBe(70);
    const template = templates[0];
    const html = renderToStaticMarkup(React.createElement(template.component, { frontmatter: {}, body: "", themeVariables: theme, photo: "data:image/png;base64,test" }));
    expect(html).toContain("object-fit:contain");
    expect(html).toContain("object-position:50% 70%");
  });
});
