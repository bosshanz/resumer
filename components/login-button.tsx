"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Code2, ArrowRight } from "lucide-react";

export function LoginButton({ githubEnabled }: { githubEnabled: boolean }) {
  const [name, setName] = useState("Dev User");

  if (githubEnabled) {
    return (
      <button
        type="button"
        onClick={() => signIn("github", { callbackUrl: "/" })}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white dark:focus-visible:ring-offset-zinc-900"
      >
        <Code2 className="h-4 w-4" aria-hidden />
        使用 GitHub 登录
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    );
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    signIn("credentials", { name: name.trim() || "Dev User", callbackUrl: "/" });
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-500">本地用户名（开发模式，未配置 GitHub OAuth）</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>
      <button
        type="submit"
        className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white dark:focus-visible:ring-offset-zinc-900"
      >
        进入编辑器
        <ArrowRight className="h-4 w-4" aria-hidden />
      </button>
    </form>
  );
}
