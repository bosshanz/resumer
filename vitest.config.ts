import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // 模板组件通过 @/ 别名引用 components/（如 modern-header），与 tsconfig paths 保持一致
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    // 默认排除项之外，还需要忽略生产构建产物（.next/standalone 里带有 lib/ 的完整副本）
    exclude: ["**/node_modules/**", "**/.git/**", "**/.next/**", "**/dist/**"],
  },
});
