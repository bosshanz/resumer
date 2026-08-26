import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // 默认排除项之外，还需要忽略生产构建产物（.next/standalone 里带有 lib/ 的完整副本）
    exclude: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/dist/**"],
  },
});
