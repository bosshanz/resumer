"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { Code2, ArrowRight, ShieldAlert, KeyRound, Loader2 } from "lucide-react";

export interface AuthModeConfig {
  githubEnabled: boolean;
  passwordRequired?: boolean;
  canLogin?: boolean;
}

export function LoginButton({
  githubEnabled,
  passwordRequired = false,
  canLogin = true,
}: {
  githubEnabled: boolean;
  passwordRequired?: boolean;
  canLogin?: boolean;
}) {
  const [name, setName] = useState("Dev User");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

  if (!canLogin) {
    return (
      <div
        role="alert"
        className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200"
      >
        <div className="flex items-start gap-2.5">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="space-y-1">
            <p className="font-semibold">生产环境未配置安全认证</p>
            <p className="text-xs leading-5 text-amber-800 dark:text-amber-300">
              为保护简历数据安全，生产模式下已禁用免密登录。请在环境变量中配置{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px] font-mono dark:bg-amber-900/60">
                GITHUB_ID
              </code>{" "}
              与{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px] font-mono dark:bg-amber-900/60">
                GITHUB_SECRET
              </code>
              ，或设置{" "}
              <code className="rounded bg-amber-100 px-1 py-0.5 text-[11px] font-mono dark:bg-amber-900/60">
                AUTH_PASSWORD
              </code>{" "}
              访问口令。
            </p>
          </div>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        name: name.trim() || "Dev User",
        password: password.trim(),
        redirect: false,
        callbackUrl: "/",
      });

      if (res?.error) {
        setError(res.error === "CredentialsSignin" ? "访问口令不正确" : res.error);
        setLoading(false);
      } else if (res?.ok) {
        window.location.href = "/";
      }
    } catch {
      setError("登录请求失败，请稍后重试");
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-zinc-500">
          {passwordRequired ? "账户名称" : "本地用户名（开发模式，未配置 GitHub OAuth）"}
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={loading}
          className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
        />
      </label>

      {passwordRequired && (
        <label className="flex flex-col gap-1.5">
          <span className="flex items-center gap-1 text-xs font-medium text-zinc-500">
            <KeyRound className="h-3.5 w-3.5" />
            访问口令 (AUTH_PASSWORD)
          </span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            placeholder="请输入访问口令"
            required
            className="min-h-11 rounded-lg border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-zinc-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          />
        </label>
      )}

      {error && (
        <div role="alert" className="text-xs text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white dark:focus-visible:ring-offset-zinc-900"
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <>
            进入编辑器
            <ArrowRight className="h-4 w-4" aria-hidden />
          </>
        )}
      </button>
    </form>
  );
}
