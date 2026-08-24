"use client";

import { templates } from "@/lib/templates";
import { Check } from "lucide-react";

interface TemplateSelectorProps {
  value: string;
  onChange: (templateId: string) => void;
  variant?: "toolbar" | "panel";
}

export function TemplateSelector({ value, onChange, variant = "toolbar" }: TemplateSelectorProps) {
  const panel = variant === "panel";

  return (
    <div
      className={panel ? "grid grid-cols-1 gap-2" : "flex max-w-[46vw] items-center gap-1.5 overflow-x-auto py-0.5"}
      role="radiogroup"
      aria-label="简历版式"
    >
      {templates.map((t) => {
        const active = t.id === value;
        const p = t.preview;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(t.id)}
            title={`${t.name} — ${t.description}`}
            className={[
              "group relative flex flex-shrink-0 items-center gap-2 overflow-hidden rounded-md border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-zinc-900",
              panel ? "min-h-16 w-full px-3 py-2 text-left" : "h-10 px-2",
              active
                ? "border-zinc-900 shadow-sm dark:border-zinc-100"
                : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600",
            ].join(" ")}
          >
            <span
              aria-hidden
              className={[
                "flex flex-shrink-0 flex-col justify-center gap-[2px] rounded-[3px] px-[5px]",
                panel ? "h-9 w-12" : "h-7 w-9",
              ].join(" ")}
              style={{ background: p.bg, color: p.fg }}
            >
              <span
                className="h-[3px] rounded-[1px]"
                style={{ width: "70%", background: p.accent, opacity: 0.95 }}
              />
              <span
                className="h-[2px] rounded-[1px]"
                style={{ width: "85%", background: p.fg, opacity: 0.45 }}
              />
              <span
                className="h-[2px] rounded-[1px]"
                style={{ width: "60%", background: p.fg, opacity: 0.3 }}
              />
            </span>
            <span className="min-w-0 flex-1">
              <span
                className="block text-xs font-semibold tracking-tight"
                style={{ fontFamily: p.fontFamily }}
              >
                {t.name}
              </span>
              {panel && (
                <span className="mt-0.5 block text-[10px] leading-4 text-zinc-500 dark:text-zinc-400">
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
