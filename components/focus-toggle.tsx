"use client";

import { Eye, PenLine, Columns } from "lucide-react";
import React from "react";

export type FocusMode = "split" | "edit" | "preview";

// 编辑/分屏/预览三态切换；split 在窄屏下隐藏，避免挤出两根不可用的窄柱
export function FocusToggle({
  value,
  onChange,
}: {
  value: FocusMode;
  onChange: (v: FocusMode) => void;
}) {
  const opts: { id: FocusMode; icon: React.ReactNode; title: string }[] = [
    { id: "edit", icon: <PenLine className="h-3.5 w-3.5" />, title: "仅编辑器" },
    { id: "split", icon: <Columns className="h-3.5 w-3.5" />, title: "分屏" },
    { id: "preview", icon: <Eye className="h-3.5 w-3.5" />, title: "仅预览" },
  ];
  return (
    <div role="group" aria-label="工作区视图" className="flex items-center gap-0.5 rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-800">
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={value === o.id}
          title={o.title}
          className={[
            "h-8 w-8 items-center justify-center rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500",
            o.id === "split" ? "hidden md:flex" : "flex",
            value === o.id
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
              : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100",
          ].join(" ")}
        >
          {o.icon}
        </button>
      ))}
    </div>
  );
}
