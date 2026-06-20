"use client";

import { useState } from "react";
import { ThemeVariables } from "@/lib/types";
import { ChevronDown, ChevronRight } from "lucide-react";

interface ThemePanelProps {
  value: ThemeVariables;
  onChange: (vars: ThemeVariables) => void;
  onReset: () => void;
}

interface Palette {
  id: string;
  name: string;
  primary: string;
  secondary: string;
}

const palettes: Palette[] = [
  { id: "mono", name: "纯黑", primary: "#111111", secondary: "#666666" },
  { id: "ocean", name: "深海", primary: "#0a3a5c", secondary: "#ff7a45" },
  { id: "forest", name: "森林", primary: "#2d5a3d", secondary: "#c2723a" },
  { id: "crimson", name: "朱砂", primary: "#8b1e3f", secondary: "#d4a574" },
  { id: "slate", name: "板岩", primary: "#334155", secondary: "#0ea5e9" },
];

interface SizingPreset {
  id: string;
  label: string;
  baseFontSize: string;
  lineHeight: number;
}
const sizes: SizingPreset[] = [
  { id: "compact", label: "紧凑", baseFontSize: "9.5pt", lineHeight: 1.5 },
  { id: "default", label: "标准", baseFontSize: "10.5pt", lineHeight: 1.6 },
  { id: "loose", label: "宽松", baseFontSize: "11.5pt", lineHeight: 1.7 },
];

interface MarginPreset {
  id: string;
  label: string;
  v: string;
  h: string;
}
const margins: MarginPreset[] = [
  { id: "compact", label: "紧凑", v: "14mm", h: "18mm" },
  { id: "default", label: "标准", v: "18mm", h: "22mm" },
  { id: "loose", label: "宽松", v: "24mm", h: "28mm" },
];

function activePalette(v: ThemeVariables): string | null {
  return (
    palettes.find((p) => p.primary === v.primaryColor && p.secondary === v.secondaryColor)?.id ??
    null
  );
}
function activeSize(v: ThemeVariables): string | null {
  return (
    sizes.find((s) => s.baseFontSize === v.baseFontSize && s.lineHeight === v.lineHeight)?.id ??
    null
  );
}
function activeMargin(v: ThemeVariables): string | null {
  return (
    margins.find((m) => m.v === v.marginTop && m.v === v.marginBottom && m.h === v.marginLeft && m.h === v.marginRight)?.id ??
    null
  );
}

export function ThemePanel({ value, onChange, onReset }: ThemePanelProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const applyPalette = (p: Palette) =>
    onChange({ ...value, primaryColor: p.primary, secondaryColor: p.secondary });
  const applySize = (s: SizingPreset) =>
    onChange({ ...value, baseFontSize: s.baseFontSize, lineHeight: s.lineHeight });
  const applyMargin = (m: MarginPreset) =>
    onChange({ ...value, marginTop: m.v, marginBottom: m.v, marginLeft: m.h, marginRight: m.h });

  const palId = activePalette(value);
  const sizeId = activeSize(value);
  const mgnId = activeMargin(value);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-sm font-semibold tracking-tight">样式</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-xs text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline dark:hover:text-zinc-100"
        >
          重置为模板默认
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        <Section label="配色">
          <div className="flex gap-2">
            {palettes.map((p) => {
              const active = palId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPalette(p)}
                  title={p.name}
                  aria-pressed={active}
                  className={[
                    "group relative h-12 w-full overflow-hidden rounded-md border transition-all",
                    active
                      ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
                      : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600",
                  ].join(" ")}
                >
                  <span className="absolute inset-0 flex">
                    <span className="flex-[3]" style={{ background: p.primary }} />
                    <span className="flex-1" style={{ background: p.secondary }} />
                  </span>
                  <span
                    className={[
                      "absolute inset-x-0 bottom-0 truncate bg-white/85 px-1 py-0.5 text-center text-[10px] font-medium tracking-tight backdrop-blur-sm dark:bg-zinc-900/85",
                      active ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-600 dark:text-zinc-400",
                    ].join(" ")}
                  >
                    {p.name}
                  </span>
                </button>
              );
            })}
          </div>
        </Section>

        <Section label="字号">
          <Segmented
            options={sizes.map((s) => ({ id: s.id, label: s.label }))}
            value={sizeId}
            onChange={(id) => {
              const s = sizes.find((x) => x.id === id);
              if (s) applySize(s);
            }}
          />
        </Section>

        <Section label="页边距">
          <Segmented
            options={margins.map((m) => ({ id: m.id, label: m.label }))}
            value={mgnId}
            onChange={(id) => {
              const m = margins.find((x) => x.id === id);
              if (m) applyMargin(m);
            }}
          />
        </Section>

        <Section label="照片排版">
          <Segmented
            options={[
              { id: "default", label: "模板默认" },
              { id: "floating-monolith", label: "浮岛肖像" },
            ]}
            value={value.photoLayout || "default"}
            onChange={(id) => onChange({ ...value, photoLayout: id as "default" | "floating-monolith" })}
          />
        </Section>

        <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {advancedOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            高级
          </button>
          {advancedOpen && (
            <div className="mt-3 space-y-2">
              <RawField
                label="主色"
                value={value.primaryColor || ""}
                onChange={(v) => onChange({ ...value, primaryColor: v })}
                color
              />
              <RawField
                label="副色"
                value={value.secondaryColor || ""}
                onChange={(v) => onChange({ ...value, secondaryColor: v })}
                color
              />
              <RawField
                label="文字色"
                value={value.textColor || ""}
                onChange={(v) => onChange({ ...value, textColor: v })}
                color
              />
              <RawField
                label="背景色"
                value={value.backgroundColor || ""}
                onChange={(v) => onChange({ ...value, backgroundColor: v })}
                color
              />
              <RawField
                label="正文字体"
                value={value.fontFamily || ""}
                onChange={(v) => onChange({ ...value, fontFamily: v })}
              />
              <RawField
                label="基准字号"
                value={value.baseFontSize || ""}
                onChange={(v) => onChange({ ...value, baseFontSize: v })}
              />
              <div className="grid grid-cols-2 gap-2">
                <RawField
                  label="上边距"
                  value={value.marginTop || ""}
                  onChange={(v) => onChange({ ...value, marginTop: v })}
                />
                <RawField
                  label="下边距"
                  value={value.marginBottom || ""}
                  onChange={(v) => onChange({ ...value, marginBottom: v })}
                />
                <RawField
                  label="左边距"
                  value={value.marginLeft || ""}
                  onChange={(v) => onChange({ ...value, marginLeft: v })}
                />
                <RawField
                  label="右边距"
                  value={value.marginRight || ""}
                  onChange={(v) => onChange({ ...value, marginRight: v })}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500">
        {label}
      </div>
      {children}
    </div>
  );
}

function Segmented({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 rounded-md bg-zinc-100 p-1 dark:bg-zinc-800/60">
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className={[
              "rounded py-1.5 text-xs font-medium transition-all",
              active
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
            ].join(" ")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function RawField({
  label,
  value,
  onChange,
  color = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  color?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        {color && (
          <input
            type="color"
            value={value || "#000000"}
            onChange={(e) => onChange(e.target.value)}
            className="h-7 w-7 flex-shrink-0 rounded border border-zinc-300 p-0.5 dark:border-zinc-700"
          />
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
    </label>
  );
}
