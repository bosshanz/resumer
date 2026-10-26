// AI 共创端到端回归：AI_PROVIDER=mock 驱动真实 UI，只用临时 SQLite 与独立端口，不碰用户数据库。
// 用法：npm run build && node scripts/test-cocreate-flows.mjs
// 可选：BASE=http://localhost:3000 复用已在跑的 mock 服务；SHOTS=目录 指定截图输出位置。
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import puppeteer from "puppeteer-core";

const shots = process.env.SHOTS || "/tmp/resumer-cocreate-flows";
await fs.mkdir(shots, { recursive: true });
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

let server;
let serverOutput = "";
let base = process.env.BASE;
if (!base) {
  await fs.access(".next/BUILD_ID").catch(() => {
    throw new Error("Run npm run build before the isolated co-create test");
  });
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "resumer-cocreate-test-"));
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  base = `http://localhost:${port}`;
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--port", String(port)], {
    env: { ...process.env, DATABASE_URL: path.join(temporary, "test.db"), NEXTAUTH_URL: base,
      NEXTAUTH_SECRET: "isolated-cocreate-test-secret-not-for-production", ALLOW_INSECURE_DEV_LOGIN: "true",
      AI_PROVIDER: "mock", AI_MODEL: "", DEEPSEEK_API_KEY: "", GITHUB_ID: "", GITHUB_SECRET: "", AUTH_PASSWORD: "",
      HTTP_PROXY: "", HTTPS_PROXY: "" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.on("data", (data) => { serverOutput += data; });
  server.stderr.on("data", (data) => { serverOutput += data; });
}

let browser;
try {
  await until(async () => {
    if (server && server.exitCode !== null) throw new Error(serverOutput);
    return fetch(base).then((response) => response.ok).catch(() => false);
  }, 30000);
  browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH ||
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", headless: true, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "light" }]);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });

  const shot = async (name) => {
    await delay(350);
    await page.screenshot({ path: path.join(shots, `${name}.png`) });
  };
  const clickText = async (value) => page.locator(`::-p-text(${value})`).click();
  const resumeId = () => new URL(page.url()).searchParams.get("resumeId");
  const content = () => page.evaluate(async (id) => {
    const response = await fetch(`/api/resumes/${id}`);
    return (await response.json()).resume.content;
  }, resumeId());
  const idle = async () => {
    await page.waitForSelector(".cc-chat-inner[data-busy]", { timeout: 4000 }).catch(() => undefined);
    await page.waitForSelector(".cc-chat-inner:not([data-busy])", { timeout: 30000 });
    await delay(300);
  };
  const say = async (text) => {
    await page.click(".cc-composer textarea");
    await page.keyboard.type(text);
    await page.keyboard.press("Enter");
    await idle();
  };
  const openCocreate = async () => {
    await page.waitForSelector('button[aria-label="AI 共创"]');
    await page.click('button[aria-label="AI 共创"]');
    await page.waitForSelector(".cc-chat-inner");
    await page.waitForSelector(".cc-loading", { hidden: true });
  };
  // 点在行首圆点附近，避免点到行内的「待补」按钮
  const selectBullet = (text) => page.locator(`.cc-row[aria-label*="${text}"]`).click({ offset: { x: 4, y: 10 } });

  // 登录（每次用新用户，互不干扰）
  await page.goto(base);
  await page.waitForSelector('button[type="submit"]');
  await page.evaluate(async (name) => {
    const { csrfToken } = await (await fetch("/api/auth/csrf")).json();
    await fetch("/api/auth/callback/credentials", { method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ csrfToken, name, json: "true" }) });
  }, `cocreate-${Date.now()}`);
  await page.goto(base);
  await page.waitForSelector('[data-testid="resume-selector-button"]');
  const sampleId = await page.evaluate(async () => (await (await fetch("/api/resumes")).json()).resumes[0].id);

  // 1. 空白起点：三条路径
  await openCocreate();
  await page.waitForSelector(".cc-start");
  await shot("01-start-choose-path");

  // 2. 从零开始：新建空白简历，不动原来那份
  await clickText("从零开始");
  await page.waitForFunction((id) => new URLSearchParams(location.search).get("resumeId") !== id, {}, sampleId);
  await page.waitForSelector(".cc-thread");
  await idle();
  assert.notEqual(resumeId(), sampleId);
  await say("我叫林晓，想找后端开发的工作");
  await say("我2021年7月到至今在字节跳动做后端工程师");
  await say("我负责重构订单服务的缓存层。另外搭建了压测平台");
  let doc = await content();
  assert.match(doc, /林晓/);
  assert.match(doc, /### 字节跳动 \| 后端工程师 \| 2021\.07 - 至今/);
  assert.match(doc, /重构订单服务的缓存层，效果「待补：量化结果」/);
  await shot("02-mid-interview");

  // 3. 在稿面上直接填「待补」
  await page.click("[data-pending]");
  await page.waitForSelector(".cc-fill input");
  await page.keyboard.type("缓存命中率从 82% 提升到 97%");
  await shot("03-fill-pending");
  await page.keyboard.press("Enter");
  await until(async () => /重构订单服务的缓存层，效果缓存命中率从 82% 提升到 97%/.test(await content()));

  // 4. 选中一条要点，用快捷动作
  await selectBullet("搭建了压测平台");
  await page.waitForSelector(".cc-row-actions");
  await shot("04-selection-toolbar");
  await clickText("按 STAR 重写");
  await idle();
  doc = await content();
  assert.match(doc, /在「待补：业务背景」下，搭建了压测平台，最终「待补：结果与数字」/);
  await shot("05-selection-action-star");

  // 5. 人工改动：AI 下一轮看得到，并且不覆盖
  const human = "搭建全链路压测平台，支撑大促前的容量评估";
  await selectBullet("搭建了压测平台");
  await page.click(".cc-row-actions button:first-child");
  await page.waitForSelector(".cc-line-editor textarea");
  await page.$eval(".cc-line-editor textarea", (node) => node.select());
  await page.keyboard.type(human);
  await page.keyboard.press("Enter");
  await say("另外我还接入了全链路监控告警");
  doc = await content();
  assert.ok(doc.includes(`- ${human}`), "human edit survives the next AI turn");
  assert.match(doc, /接入了全链路监控告警/);
  const reply = await page.$$eval(".cc-msg-ai .cc-reply", (nodes) => nodes.at(-1).textContent);
  assert.match(reply, /以你的版本为准/);
  await shot("06-human-edit-respected");

  // 6. 撤销单条 AI 改动
  const lastUndo = await page.$$(".cc-edits li button");
  await lastUndo.at(-1).click();
  await until(async () => !/接入了全链路监控告警/.test(await content()));
  assert.ok((await content()).includes(`- ${human}`));

  // 7. 出错：模型报错时可重试
  await say("#mock-error");
  await page.waitForSelector(".cc-error");
  await shot("07-error-retry");

  // 8. 窄窗口：对话 / 简历分栏切换
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3 });
  await delay(400);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.ok(overflow <= 0, `no horizontal overflow (got ${overflow}px)`);
  await shot("08-narrow-chat");
  await page.click('.cc-tabs [data-tab-key="doc"]');
  await page.waitForSelector(".cc-draft");
  await shot("09-narrow-resume");
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });

  // 9. 导入旧简历：回到示例简历，粘贴文本
  await page.goto(`${base}/?resumeId=${sampleId}`);
  await openCocreate();
  await page.waitForSelector(".cc-start");
  const blankResume = await page.evaluate(async () => {
    const response = await fetch("/api/resumes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ blank: true }) });
    return (await response.json()).resume.id;
  });
  await page.goto(`${base}/?resumeId=${blankResume}`);
  await openCocreate();
  await clickText("导入旧简历");
  await page.waitForSelector(".cc-import textarea");
  await page.click(".cc-import textarea");
  await page.keyboard.type([
    "王雨", "wangyu@example.com 13800001234",
    "美团 | 数据分析师 | 2020.03 - 2023.06", "- 搭建经营看板，覆盖 12 个城市", "- 负责商家流失预警模型",
    "复旦大学 统计学 2016.09 - 2020.06",
  ].join("\n"));
  await shot("10-import-paste");
  await clickText("开始整理");
  await idle();
  doc = await content();
  assert.match(doc, /### 美团 \| 数据分析师 \| 2020\.03 - 2023\.06/);
  assert.match(doc, /搭建经营看板，覆盖 12 个城市/);
  await shot("11-import-done");

  // 10. 深色模式
  await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
  await shot("12-dark-mode");

  const unexpected = errors.filter((message) => !/Failed to load resource/.test(message));
  assert.deepEqual(unexpected, [], "no page errors");
  console.log(`co-create flows passed; screenshots in ${shots}`);
} catch (error) {
  if (serverOutput) console.error(serverOutput.slice(-4000));
  throw error;
} finally {
  await browser?.close();
  server?.kill();
}
