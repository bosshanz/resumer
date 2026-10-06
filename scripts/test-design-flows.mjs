// 隔离的生产浏览器回归：只用临时 SQLite 和独立端口，不碰用户数据库。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import Database from "better-sqlite3";
import puppeteer from "puppeteer-core";

await fs.access(".next/BUILD_ID").catch(() => {
  throw new Error("Run npm run build before the isolated design-flow test");
});
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "resumer-design-test-"));
const databasePath = path.join(temporary, "test.db");
const screenshotDir = "/tmp/resumer-design-flows";
await fs.mkdir(screenshotDir, { recursive: true });
const probe = net.createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], {
  env: { ...process.env, DATABASE_URL: databasePath, NEXTAUTH_URL: base,
    NEXTAUTH_SECRET: "isolated-design-test-secret-not-for-production",
    GITHUB_ID: "", GITHUB_SECRET: "", HTTP_PROXY: "", HTTPS_PROXY: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", (data) => { serverOutput += data; });
server.stderr.on("data", (data) => { serverOutput += data; });
let browser;
let db;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await delay(50);
  }
  throw new Error("Timed out waiting for test condition");
}

try {
  await until(async () => {
    if (server.exitCode !== null) throw new Error(serverOutput);
    return fetch(base).then((response) => response.ok).catch(() => false);
  });
  browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: temporary });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));

  const faults = { list: 1, detail: 1, save: false, apply: 1, pdf: 1 };
  const seen = { patch: 0, restore: 0, apply: 0, pdf: [] };
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    try {
      const url = new URL(request.url());
      const pathname = url.pathname;
      const method = request.method();
      if (method === "GET" && /^\/api\/resumes\/[^/]+\/versions$/.test(pathname) && faults.list > 0) {
        faults.list--;
        await request.respond({ status: 503, contentType: "application/json", body: '{"error":"Injected list failure"}' });
      } else if (method === "GET" && /^\/api\/resumes\/[^/]+\/versions\/[^/]+$/.test(pathname) && faults.detail > 0) {
        faults.detail--;
        await request.respond({ status: 503, contentType: "application/json", body: '{"error":"Injected detail failure"}' });
      } else if (method === "PATCH" && /^\/api\/resumes\/[^/]+$/.test(pathname)) {
        seen.patch++;
        if (faults.save) await request.respond({ status: 503, contentType: "application/json", body: '{"error":"Injected save failure"}' });
        else await request.continue();
      } else if (method === "POST" && /\/versions\/[^/]+\/restore$/.test(pathname)) {
        seen.restore++;
        await request.continue();
      } else if (method === "POST" && /\/api\/rewrites\/[^/]+\/apply$/.test(pathname)) {
        seen.apply++;
        if (faults.apply > 0) {
          faults.apply--;
          await request.respond({ status: 503, contentType: "application/json", body: '{"error":"Injected apply failure"}' });
        } else await request.continue();
      } else if (method === "POST" && pathname === "/api/export/pdf") {
        seen.pdf.push(JSON.parse(request.postData() || "{}"));
        if (faults.pdf > 0) {
          faults.pdf--;
          await request.respond({ status: 503, contentType: "application/json", body: '{"error":"Injected PDF failure"}' });
        } else {
          await request.continue();
        }
      } else await request.continue();
    } catch (error) {
      if (!request.isInterceptResolutionHandled()) await request.continue();
      errors.push(String(error));
    }
  });

  await page.goto(base);
  await page.waitForSelector('button[type="submit"]');
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="resume-selector-button"]');
  const initial = await page.evaluate(async () => (await (await fetch("/api/resumes")).json()).resumes[0]);
  assert.ok(initial?.id);
  db = new Database(databasePath);
  const original = db.prepare("SELECT * FROM resumes WHERE id = ?").get(initial.id);
  // Ensure an older version exists before editing, without relying on the autosave timer.
  await page.evaluate(async (id) => {
    const response = await fetch(`/api/resumes/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ snapshot: true }),
    });
    if (!response.ok) throw new Error("Could not seed history");
  }, initial.id);
  assert.equal(db.prepare("SELECT count(*) n FROM resume_versions WHERE resume_id = ?").get(initial.id).n, 1);

  const clickText = async (value) => page.locator(`::-p-text(${value})`).click();
  const openHistory = async () => {
    await page.click('button[aria-label="更多操作"]');
    await clickText("历史版本…");
    await page.waitForSelector('[data-testid="history-dialog"]');
  };
  const changeTitle = async (value) => {
    await page.click('header input[type="text"]');
    await page.$eval('header input[type="text"]', (input) => input.select());
    await page.keyboard.type(value);
  };
  const beforeHistoryCount = db.prepare("SELECT count(*) n FROM resume_versions WHERE resume_id = ?").get(initial.id).n;
  await changeTitle("即时恢复前的最新编辑");
  await openHistory();
  await page.waitForFunction(() => document.body.textContent.includes("历史版本未能加载"));
  await clickText("重试加载");
  await page.waitForFunction(() => document.body.textContent.includes("版本预览未能加载"));
  await clickText("重试预览");
  await page.waitForFunction(() => document.body.textContent.includes("只读预览"));
  await page.screenshot({ path: path.join(screenshotDir, "history-preview.png"), fullPage: true });
  assert.equal(db.prepare("SELECT count(*) n FROM resume_versions WHERE resume_id = ?").get(initial.id).n, beforeHistoryCount,
    "Viewing history must not create snapshots");
  await page.click('[data-testid="restore-version-button"]');
  await until(() => seen.restore === 1);
  await until(() => db.prepare("SELECT title FROM resumes WHERE id = ?").get(initial.id).title === original.title);
  assert.ok(db.prepare("SELECT id FROM resume_versions WHERE resume_id = ? AND title = ?")
    .get(initial.id, "即时恢复前的最新编辑"), "The latest edit must be saved before restoration");
  assert.equal(await page.$eval('header input[type="text"]', (el) => el.value), original.title);
  console.log("PASS: list/detail retry, read-only preview, immediate edit flushed before restore");

  // Failed save blocks the restore request and keeps the unsaved text in the editor.
  await changeTitle("保存失败仍保留");
  faults.save = true;
  await openHistory();
  await page.waitForSelector('[data-testid="restore-version-button"]:not([disabled])');
  const restoresBeforeFailure = seen.restore;
  await page.click('[data-testid="restore-version-button"]');
  await page.waitForFunction(() => document.body.textContent.includes("当前编辑未能保存"));
  assert.equal(seen.restore, restoresBeforeFailure);
  assert.equal(db.prepare("SELECT title FROM resumes WHERE id = ?").get(initial.id).title, original.title);
  await page.click('[data-testid="history-dialog"] button[aria-label="关闭"]');
  assert.equal(await page.$eval('header input[type="text"]', (el) => el.value), "保存失败仍保留");
  faults.save = false;
  await page.click('header button[title="点击重试保存"]');
  await until(() => db.prepare("SELECT title FROM resumes WHERE id = ?").get(initial.id).title === "保存失败仍保留");
  console.log("PASS: failed save blocks restore and keeps input");

  // Seed a deterministic ready suggestion without making an AI request.
  const draft = String(original.content).replace("张三", "建议稿验证");
  const userId = db.prepare("SELECT user_id FROM resumes WHERE id = ?").get(initial.id).user_id;
  db.prepare(`INSERT INTO rewrite_sessions
    (id, user_id, source_resume_id, job_description, draft_content, change_notes, pending_items, status)
    VALUES (?, ?, ?, ?, ?, '[]', '[]', 'ready')`)
    .run("isolated-ready-session", userId, initial.id, "用于隔离回归测试的职位方向", draft);
  await clickText("改写");
  await page.waitForFunction(() => document.body.textContent.includes("建议稿 · 尚未另存"));
  await page.waitForFunction(() => Array.from(document.querySelectorAll("header button"))
    .some((button) => button.textContent.includes("另存后导出")));
  const clickSaveAndExport = async () => page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("header button"))
      .find((candidate) => candidate.textContent.includes("另存后导出"));
    button.click();
  });

  // Saving the source must succeed before the apply endpoint may be called.
  await changeTitle("另存前保存失败");
  faults.save = true;
  const appliesBeforeSaveFailure = seen.apply;
  await clickSaveAndExport();
  await page.waitForFunction(() => document.body.textContent.includes("底稿保存失败"));
  assert.equal(seen.apply, appliesBeforeSaveFailure);
  assert.equal(db.prepare("SELECT count(*) n FROM resumes").get().n, 1);
  assert.equal(await page.$eval('header input[type="text"]', (el) => el.value), "另存前保存失败");
  assert.ok(await page.evaluate(() => document.body.textContent.includes("建议稿 · 尚未另存")));
  faults.save = false;

  // A failed apply leaves the source selected and the ready suggestion available for retry.
  await clickSaveAndExport();
  await page.waitForFunction(() => document.body.textContent.includes("Injected apply failure"));
  assert.equal(seen.apply, appliesBeforeSaveFailure + 1);
  assert.equal(db.prepare("SELECT count(*) n FROM resumes").get().n, 1);
  assert.equal(db.prepare("SELECT title FROM resumes WHERE id = ?").get(initial.id).title, "另存前保存失败");
  assert.equal(await page.$eval('header input[type="text"]', (el) => el.value), "另存前保存失败");
  assert.ok(await page.evaluate(() => document.body.textContent.includes("建议稿 · 尚未另存")));
  const appliesBeforeSuccess = seen.apply;

  await page.evaluate(() => {
    const button = Array.from(document.querySelectorAll("header button"))
      .find((candidate) => candidate.textContent.includes("另存后导出"));
    button.click();
    button.click();
  });
  await until(() => seen.apply === appliesBeforeSuccess + 1);
  await page.waitForFunction(() => document.body.textContent.includes("简历已另存，PDF 导出失败"));
  await page.screenshot({ path: path.join(screenshotDir, "rewrite-export-partial-failure.png"), fullPage: true });
  assert.equal(seen.apply - appliesBeforeSuccess, 1, "Rapid double click must make one apply request");
  assert.equal(seen.pdf.length, 1);
  assert.equal(seen.pdf[0].content, draft, "PDF payload must be the saved suggestion");
  assert.equal(db.prepare("SELECT count(*) n FROM resumes").get().n, 2);
  assert.equal(db.prepare("SELECT count(*) n FROM resumes WHERE content = ?").get(draft).n, 1);
  await clickText("重试导出");
  await until(() => seen.pdf.length === 2);
  const pdfPath = await until(async () => {
    const names = await fs.readdir(temporary);
    const name = names.find((entry) => entry.endsWith(".pdf"));
    return name ? path.join(temporary, name) : null;
  }, 30000);
  const pdf = await fs.readFile(pdfPath);
  assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
  assert.ok(pdf.byteLength > 1000, "The backend must generate a nonempty PDF");
  await fs.copyFile(pdfPath, path.join(screenshotDir, "suggestion-export.pdf"));
  assert.equal(seen.pdf[1].content, draft);
  assert.equal(seen.apply, appliesBeforeSuccess + 1, "PDF retry must not apply again");
  assert.equal(db.prepare("SELECT count(*) n FROM resumes").get().n, 2);
  await page.setViewport({ width: 1440, height: 900 });
  await page.click('button[aria-controls="design-drawer"]');
  await delay(200);
  await page.screenshot({ path: path.join(screenshotDir, "design-panel-1440.png") });
  await page.click('button[aria-controls="design-drawer"]');
  await page.setViewport({ width: 390, height: 844 });
  await delay(200);
  await page.screenshot({ path: path.join(screenshotDir, "mobile-editor-390.png") });
  assert.deepEqual(errors, []);
  console.log("PASS: ready suggestion exported to real PDF, partial failure retained, retry did not duplicate variant");
  console.log("PASS: source save and apply failures retain ready suggestion without creating variants");
  console.log(`Artifacts: ${screenshotDir}`);
} finally {
  db?.close();
  if (browser) {
    // A simulated PDF download can leave headless Chrome's close promise pending.
    browser.disconnect();
    browser.process()?.kill("SIGKILL");
  }
  server.kill("SIGTERM");
  if (server.exitCode === null) await Promise.race([
    new Promise((resolve) => server.once("exit", resolve)),
    delay(3000),
  ]);
  await fs.rm(temporary, { recursive: true, force: true });
}
