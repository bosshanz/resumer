"use client";

import { templates } from "@/lib/templates";
import { Check } from "lucide-react";

interface TemplateSelectorProps {
  value: string;
  onChange: (templateId: string) => void;
}

export function TemplateSelector({ value, onChange }: TemplateSelectorProps) {
  return (
    <div className="flex max-w-[46vw] items-center gap-1.5 overflow-x-auto py-0.5" role="radiogroup" aria-label="模板">
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
              "group relative flex h-10 flex-shrink-0 items-center gap-2 overflow-hidden rounded-md border px-2 transition-all",
              active
                ? "border-zinc-900 shadow-sm dark:border-zinc-100"
                : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600",
            ].join(" ")}
          >
            <span
              aria-hidden
              className="flex h-7 w-9 flex-shrink-0 flex-col justify-center gap-[2px] rounded-[3px] px-[5px]"
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
            <span
              className="text-xs font-medium tracking-tight"
              style={{ fontFamily: p.fontFamily }}
            >
              {t.name}
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
