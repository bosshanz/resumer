// Next.js instrumentation 约定：服务器实例启动时调用一次 register()。
// 在这里初始化 SQLite（建库、建表、增量迁移），路由与模块加载期因此不再各自跑副作用。
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { initDb } = await import("./lib/db");
  initDb();
}
