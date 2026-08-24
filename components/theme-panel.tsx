"use client";

import { useState } from "react";
import { ThemeVariables } from "@/lib/types";
import { TemplateSelector } from "./template-selector";
import { getContrastWarning } from "@/lib/color-contrast";
import { AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";

interface ThemePanelProps {
  value: ThemeVariables;
  templateId: string;
  onTemplateChange: (templateId: string) => void;
  onChange: (vars: ThemeVariables) => void;
  onReset: () => void;
}

type DesignTab = "layout" | "appearance" | "typography";

interface Palette {
  id: string;
  name: string;
  primary: string;
  secondary: string;
  background: string;
  text: string;
}

const palettes: Palette[] = [
  { id: "ink", name: "墨黑", primary: "#111111", secondary: "#666666", background: "#ffffff", text: "#111111" },
  { id: "ocean", name: "深海", primary: "#0a3a5c", secondary: "#ff7a45", background: "#fbfaf6", text: "#1a2332" },
  { id: "pine", name: "松林", primary: "#2d5a3d", secondary: "#c2723a", background: "#fbfaf7", text: "#18221c" },
  { id: "signal", name: "信号", primary: "#000000", secondary: "#dc2626", background: "#ffffff", text: "#0a0a0a" },
  { id: "editorial", name: "纸墨", primary: "#3a2415", secondary: "#a87b3f", background: "#faf6ed", text: "#2a1c10" },
  { id: "oxide", name: "氧化", primary: "#d42c24", secondary: "#687078", background: "#ffffff", text: "#111214" },
  { id: "brass", name: "铜绿", primary: "#213b36", secondary: "#a97828", background: "#fbf8f1", text: "#202725" },
  { id: "blueprint", name: "蓝图", primary: "#1452c2", secondary: "#52647d", background: "#ffffff", text: "#111a2d" },
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
    palettes.find(
      (p) =>
        p.primary === v.primaryColor &&
        p.secondary === v.secondaryColor &&
        p.background === v.backgroundColor &&
        p.text === v.textColor
    )?.id ??
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

export function ThemePanel({
  value,
  templateId,
  onTemplateChange,
  onChange,
  onReset,
}: ThemePanelProps) {
  const [activeTab, setActiveTab] = useState<DesignTab>("layout");
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const applyPalette = (p: Palette) =>
    onChange({
      ...value,
      primaryColor: p.primary,
      secondaryColor: p.secondary,
      backgroundColor: p.background,
      textColor: p.text,
    });
  const applySize = (s: SizingPreset) =>
    onChange({ ...value, baseFontSize: s.baseFontSize, lineHeight: s.lineHeight });
  const applyMargin = (m: MarginPreset) =>
    onChange({ ...value, marginTop: m.v, marginBottom: m.v, marginLeft: m.h, marginRight: m.h });

  const palId = activePalette(value);
  const sizeId = activeSize(value);
  const mgnId = activeMargin(value);
  const background = value.backgroundColor || "#ffffff";
  const contrastChecks = [
    { label: "文字色", status: getContrastWarning(value.textColor || "#111111", background) },
    { label: "主色", status: getContrastWarning(value.primaryColor || "#111111", background) },
    { label: "副色", status: getContrastWarning(value.secondaryColor || "#666666", background) },
  ];
  const contrastWarnings = contrastChecks.filter((check) => check.status.level === "warning");

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div>
          <h2 id="design-panel-title" className="text-sm font-semibold tracking-tight">设计</h2>
          <p className="mt-0.5 text-[10px] text-zinc-500 dark:text-zinc-400">版式与简历外观独立于编辑器界面</p>
        </div>
        <button
          type="button"
          onClick={onReset}
          className="rounded px-1.5 py-1 text-xs text-zinc-500 underline-offset-2 hover:bg-zinc-100 hover:text-zinc-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
        >
          重置为模板默认
        </button>
      </div>

      <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
        <div role="tablist" aria-label="设计设置" className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800/70">
          <DesignTabButton id="layout" label="版式" active={activeTab === "layout"} onSelect={setActiveTab} />
          <DesignTabButton id="appearance" label="外观" active={activeTab === "appearance"} onSelect={setActiveTab} />
          <DesignTabButton id="typography" label="排版" active={activeTab === "typography"} onSelect={setActiveTab} />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4">
        {activeTab === "layout" && (
          <div role="tabpanel" id="design-layout-panel" aria-labelledby="design-layout-tab">
            <Section label="简历版式">
              <TemplateSelector value={templateId} onChange={onTemplateChange} variant="panel" />
            </Section>
          </div>
        )}

        {activeTab === "appearance" && (
          <div role="tabpanel" id="design-appearance-panel" aria-labelledby="design-appearance-tab">
            <Section label="配色">
              <div className="grid grid-cols-2 gap-2">
                {palettes.map((p) => {
                  const active = palId === p.id;
                  const paletteContrast = getContrastWarning(p.secondary, p.background);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => applyPalette(p)}
                      title={`${p.name} · ${paletteContrast.message}`}
                      aria-label={`${p.name}，${paletteContrast.message}`}
                      aria-pressed={active}
                      className={[
                        "group relative h-12 overflow-hidden rounded-md border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:focus-visible:ring-zinc-300 dark:focus-visible:ring-offset-zinc-900",
                        active
                          ? "border-zinc-900 ring-1 ring-zinc-900 dark:border-zinc-100 dark:ring-zinc-100"
                          : "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600",
                      ].join(" ")}
                      style={{ backgroundColor: p.background, color: p.text }}
                    >
                      <span className="absolute inset-x-0 top-0 flex h-7">
                        <span className="flex-[3]" style={{ background: p.primary }} />
                        <span className="flex-1" style={{ background: p.secondary }} />
                      </span>
                      {paletteContrast.level === "warning" && (
                        <span className="absolute right-1 top-1 rounded-full bg-white/90 p-0.5 text-amber-700 shadow-sm" aria-hidden>
                          <AlertTriangle className="h-2.5 w-2.5" />
                        </span>
                      )}
                      <span
                        className={[
                          "absolute inset-x-0 bottom-0 truncate bg-black/[0.035] px-1 py-0.5 text-center text-[10px] font-medium tracking-tight",
                          active ? "font-semibold" : "opacity-75",
                        ].join(" ")}
                      >
                        {p.name}
                      </span>
                    </button>
                  );
                })}
              </div>
              {contrastWarnings.length > 0 && (
                <div role="status" className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                  <span>
                    {contrastWarnings.map((check) => `${check.label} ${check.status.ratio?.toFixed(2)}:1`).join("，")}；低对比色请仅用于装饰，正文建议至少 4.5:1。
                  </span>
                </div>
              )}
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

            <AdvancedToggle open={advancedOpen} onToggle={() => setAdvancedOpen((v) => !v)} label="高级颜色" />
            {advancedOpen && (
              <div className="mt-3 space-y-2">
                <RawField label="主色" value={value.primaryColor || ""} onChange={(v) => onChange({ ...value, primaryColor: v })} color />
                <RawField label="副色" value={value.secondaryColor || ""} onChange={(v) => onChange({ ...value, secondaryColor: v })} color />
                <RawField label="文字色" value={value.textColor || ""} onChange={(v) => onChange({ ...value, textColor: v })} color />
                <RawField label="背景色" value={value.backgroundColor || ""} onChange={(v) => onChange({ ...value, backgroundColor: v })} color />
              </div>
            )}
          </div>
        )}

        {activeTab === "typography" && (
          <div role="tabpanel" id="design-typography-panel" aria-labelledby="design-typography-tab">
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

            <AdvancedToggle open={advancedOpen} onToggle={() => setAdvancedOpen((v) => !v)} label="高级排版" />
            {advancedOpen && (
              <div className="mt-3 space-y-2">
                <RawField label="正文字体" value={value.fontFamily || ""} onChange={(v) => onChange({ ...value, fontFamily: v })} />
                <RawField label="标题字体" value={value.headingFontFamily || ""} onChange={(v) => onChange({ ...value, headingFontFamily: v })} />
                <RawField label="基准字号" value={value.baseFontSize || ""} onChange={(v) => onChange({ ...value, baseFontSize: v })} />
                <div className="grid grid-cols-2 gap-2">
                  <RawField label="上边距" value={value.marginTop || ""} onChange={(v) => onChange({ ...value, marginTop: v })} />
                  <RawField label="下边距" value={value.marginBottom || ""} onChange={(v) => onChange({ ...value, marginBottom: v })} />
                  <RawField label="左边距" value={value.marginLeft || ""} onChange={(v) => onChange({ ...value, marginLeft: v })} />
                  <RawField label="右边距" value={value.marginRight || ""} onChange={(v) => onChange({ ...value, marginRight: v })} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DesignTabButton({
  id,
  label,
  active,
  onSelect,
}: {
  id: DesignTab;
  label: string;
  active: boolean;
  onSelect: (id: DesignTab) => void;
}) {
  const tabOrder: DesignTab[] = ["layout", "appearance", "typography"];
  const moveFocus = (direction: -1 | 1) => {
    const index = tabOrder.indexOf(id);
    const next = tabOrder[(index + direction + tabOrder.length) % tabOrder.length];
    onSelect(next);
    requestAnimationFrame(() => document.getElementById(`design-${next}-tab`)?.focus());
  };

  return (
    <button
      id={`design-${id}-tab`}
      type="button"
      role="tab"
      aria-selected={active}
      aria-controls={`design-${id}-panel`}
      tabIndex={active ? 0 : -1}
      onClick={() => onSelect(id)}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          moveFocus(-1);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          moveFocus(1);
        }
      }}
      className={[
        "rounded-md px-2 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500",
        active
          ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
          : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function AdvancedToggle({ open, onToggle, label }: { open: boolean; onToggle: () => void; label: string }) {
  return (
    <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-800">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-1 rounded py-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:text-zinc-400 dark:hover:text-zinc-100"
      >
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        {label}
      </button>
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
    <div
      className="grid gap-1 rounded-md bg-zinc-100 p-1 dark:bg-zinc-800/60"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={active}
            className={[
              "min-h-8 rounded py-1.5 text-xs font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500",
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
            className="h-8 w-8 flex-shrink-0 rounded border border-zinc-300 p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:border-zinc-700"
          />
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-8 flex-1 rounded-md border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </div>
    </label>
  );
}
