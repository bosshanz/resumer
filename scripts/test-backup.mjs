// 使用临时数据库和独立端口验证生产构建，不读写用户简历。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";

const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "resumer-backup-test-"));
const probe = net.createServer();
await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));
const base = `http://localhost:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], {
  env: { ...process.env, DATABASE_URL: path.join(temporary, "test.db"),
    NEXTAUTH_URL: base, NEXTAUTH_SECRET: "isolated-backup-test-secret-not-for-production",
    GITHUB_ID: "", GITHUB_SECRET: "", HTTP_PROXY: "", HTTPS_PROXY: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
server.stdout.on("data", (data) => { serverOutput += data; });
server.stderr.on("data", (data) => { serverOutput += data; });
let browser;
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function until(check, timeout = 15000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await check();
    if (value) return value;
    await delay(100);
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
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const cdp = await page.createCDPSession();
  await cdp.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: temporary });
  await page.goto(base);
  await page.waitForSelector('button[type="submit"]');
  await page.click('button[type="submit"]');
  await page.waitForSelector('[data-testid="resume-selector-button"]');
  const original = await page.evaluate(async () => (await (await fetch("/api/resumes")).json()).resumes[0]);

  // 编辑后立即备份：检查点击下载时的编辑被 flush，而不依赖 1 秒自动保存。
  const title = "备份即时保存验证";
  await page.click('header input[type="text"]');
  await page.$eval('header input[type="text"]', (input) => input.select());
  await page.keyboard.type(title);
  await page.click('button[aria-label="更多操作"]');
  const clickText = async (text) => page.locator(`::-p-text(${text})`).click();
  await clickText("备份与恢复…");
  await page.waitForSelector('[role="dialog"][aria-labelledby="backup-title"]');
  await clickText("下载备份");
  const file = await until(async () => {
    const names = await fs.readdir(temporary);
    const name = names.find((name) => name.startsWith("resumer-backup-") && name.endsWith(".json"));
    return name ? path.join(temporary, name) : null;
  });
  const backup = JSON.parse(await fs.readFile(file, "utf8"));
  assert.equal(backup.resumes[0].title, title);
  assert.equal(backup.resumes.length, 1);
  assert.ok(backup.versions.length >= 1);
  await page.waitForFunction(() => document.body.textContent.includes("备份已生成"));

  // 无效文件显示错误，不写入数据库；再选择刚下载的真实文件恢复。
  const invalid = path.join(temporary, "invalid.json");
  await fs.writeFile(invalid, "{}");
  const input = await page.$('input[aria-label="选择备份文件"]');
  await input.uploadFile(invalid);
  await page.waitForFunction(() => document.body.textContent.includes("备份格式不正确"));
  await input.uploadFile(file);
  await page.waitForFunction(() => document.body.textContent.includes("确认新增恢复"));
  await clickText("确认新增恢复");
  await page.waitForFunction(() => document.body.textContent.includes("已新增 1 份简历"));
  await page.click('button[aria-label="关闭备份与恢复"]');
  assert.equal(await page.$eval('header input[type="text"]', (el) => el.value), title);
  const after = await page.evaluate(async () => (await (await fetch("/api/resumes")).json()).resumes);
  assert.equal(after.length, 2);
  assert.ok(after.some((r) => r.id === original.id));
  await page.click('[data-testid="resume-selector-button"]');
  assert.equal((await page.$$('[data-testid="resume-item"]')).length, 2);
  assert.deepEqual(errors, []);
  console.log("PASS: isolated production UI backup download, save flush, invalid file, additive restore, current editor preservation, list refresh");
} finally {
  await browser?.close();
  server.kill("SIGTERM");
  if (server.exitCode === null) await new Promise((resolve) => server.once("exit", resolve));
  await fs.rm(temporary, { recursive: true, force: true });
}
