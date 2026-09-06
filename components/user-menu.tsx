"use client";

import Image from "next/image";
import { LogOut } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { useMenuDismiss } from "./use-menu-dismiss";

interface UserMenuProps {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  onSignOut: () => void;
}

// 顶栏账户菜单：头像按钮 + 用户信息与退出登录
export function UserMenu({ name, email, image, onSignOut }: UserMenuProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // 稳定引用，避免 useMenuDismiss 的 effect 每次渲染重挂监听器
  const close = useCallback(() => setOpen(false), []);
  useMenuDismiss(open, containerRef, buttonRef, close);

  return (
    <div ref={containerRef} className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="账户菜单"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:hover:bg-zinc-800"
        title={name || "账户菜单"}
      >
        {image ? (
          <Image
            src={image}
            alt=""
            width={28}
            height={28}
            className="rounded-full"
            unoptimized
          />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium dark:bg-zinc-800">
            {(name || "U").charAt(0).toUpperCase()}
          </span>
        )}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1 min-w-[180px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <div className="border-b border-zinc-200 px-3 py-2 dark:border-zinc-800">
            <div className="truncate text-sm font-medium">{name}</div>
            {email && (
              <div className="truncate text-xs text-zinc-500">{email}</div>
            )}
          </div>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
            className="flex min-h-9 w-full items-center gap-2 px-3 text-left text-sm hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500 dark:hover:bg-zinc-800"
          >
            <LogOut className="h-3.5 w-3.5" /> 退出登录
          </button>
        </div>
      )}
    </div>
  );
}
