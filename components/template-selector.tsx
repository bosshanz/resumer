"use client";

import { memo, useRef } from "react";
import { defaultResumeContent } from "@/lib/types";
import { parseResumeContent } from "@/lib/parser";
import { templates, getTemplate } from "@/lib/templates";
import { Check } from "lucide-react";

interface TemplateSelectorProps {
  value: string;
  photo?: string;
  onChange: (templateId: string) => void;
  variant?: "toolbar" | "panel";
}

export function TemplateSelector({ value, photo, onChange, variant = "toolbar" }: TemplateSelectorProps) {
  const panel = variant === "panel";
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);

  return (
    <div
      className={panel ? "grid grid-cols-1 gap-2" : "flex max-w-[46vw] items-center gap-1.5 overflow-x-auto py-0.5"}
      role="radiogroup"
      aria-label="简历版式"
    >
      {templates.map((t, index) => {
        const active = t.id === (getTemplate(value)?.id ?? templates[0].id);
        const p = t.preview;
        return (
          <button
            key={t.id}
            ref={(element) => { buttons.current[index] = element; }}
            type="button"
            role="radio"
            tabIndex={active ? 0 : -1}
            onKeyDown={(event) => {
              const offset = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1
                : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
              const next = event.key === "Home" ? 0 : event.key === "End" ? templates.length - 1
                : offset ? (index + offset + templates.length) % templates.length : null;
              if (next === null) return;
              event.preventDefault();
              onChange(templates[next].id);
              buttons.current[next]?.focus();
            }}
            aria-checked={active}
            onClick={() => onChange(t.id)}
            title={`${t.name} — ${t.description}`}
            className={[
              "group relative flex flex-shrink-0 items-center gap-2 overflow-hidden rounded-md border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-zinc-900",
              panel ? "min-h-40 w-full px-3 py-3 text-left" : "h-10 px-2",
              active
                ? "border-zinc-900 shadow-sm dark:border-zinc-100"
                : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600",
            ].join(" ")}
          >
            <TemplateThumbnail photo={photo} templateId={t.id} small={!panel} />
            <span className="min-w-0 flex-1">
              <span
                className="block text-xs font-semibold tracking-tight"
                style={{ fontFamily: p.fontFamily }}
              >
                {t.name}
              </span>
              {panel && (
                <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                  {t.description}
                </span>
              )}
            </span>
            {active && (
              <Check className="h-3.5 w-3.5 text-zinc-900 dark:text-zinc-100" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}

const thumbnailResume = parseResumeContent(defaultResumeContent);
const thumbnailTheme = {};

// Render a public text sample with the current portrait to compare photo compositions.
// Memoization keeps all five Markdown previews out of selection/settings updates.
const TemplateThumbnail = memo(function TemplateThumbnail({ templateId, small, photo }: { templateId: string; small: boolean; photo?: string }) {
  const template = templates.find((item) => item.id === templateId)!;
  const Component = template.component;
  const scale = small ? 0.035 : 0.12;
  return (
    <div
      aria-hidden="true"
      inert
      className="relative flex-shrink-0 overflow-hidden rounded-sm border border-black/10 bg-white shadow-sm"
      style={{ width: 794 * scale, height: 1123 * scale }}
    >
      <div
        className="pointer-events-none absolute left-0 top-0 origin-top-left text-left"
        style={{ width: 794, transform: `scale(${scale})` }}
      >
        <Component photo={photo} frontmatter={thumbnailResume.frontmatter} body={thumbnailResume.body} themeVariables={thumbnailTheme} />
      </div>
    </div>
  );
});
