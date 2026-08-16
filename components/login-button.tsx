"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";

export function LoginButton({ githubEnabled }: { githubEnabled: boolean }) {
  const [name, setName] = useState("Dev User");

  if (githubEnabled) {
    return (
      <button
        onClick={() => signIn("github", { callbackUrl: "/" })}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
      >
        使用 GitHub 登录
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
          className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
      </label>
      <button
        type="submit"
        className="rounded-lg bg-zinc-900 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
      >
        进入编辑器
      </button>
    </form>
  );
}
