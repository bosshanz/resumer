import puppeteer from "puppeteer-core";
import fs from "fs";
import process from "process";

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const CHROME_PATH =
  process.env.PUPPETEER_EXECUTABLE_PATH ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const COOKIE_FILE = process.env.COOKIE_FILE || "/tmp/resumer_cookies.txt";

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForSelector(page, selector, timeout = 5000) {
  await page.waitForSelector(selector, { timeout });
}

function parseSessionCookie(path) {
  const content = fs.readFileSync(path, "utf-8");
  for (const line of content.split("\n")) {
    if (line.startsWith("# ") || !line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length >= 7 && parts[5] === "next-auth.session-token") {
      return parts[6];
    }
  }
  return null;
}

async function main() {
  const sessionToken = parseSessionCookie(COOKIE_FILE);
  if (!sessionToken) {
    throw new Error("No next-auth.session-token found in cookie file");
  }

  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 800 });

    // Set session cookie from curl login
    await page.setCookie({
      name: "next-auth.session-token",
      value: sessionToken,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      sameSite: "Lax",
    });

    // Step 1: Load editor
    await page.goto(BASE_URL, { waitUntil: "networkidle0" });
    await waitForSelector(page, "[data-testid='resume-selector-button']");
    console.log("Editor loaded with resume selector");

    // Step 2: Open selector dropdown
    await page.click("[data-testid='resume-selector-button']");
    await waitForSelector(page, "[data-testid='resume-list']");
    console.log("Selector dropdown opened");

    // Capture console messages for debugging
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        console.log("[browser error]", msg.text());
      }
    });
    page.on("pageerror", (err) => console.log("[page error]", err.message));

    // Step 3: Create a new resume
    await delay(300);
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="create-resume-button"]');
      if (btn) btn.click();
      else throw new Error("create-resume-button not found in DOM");
    });
    await delay(2000);

    const newUrl = page.url();
    console.log("Created new resume, URL:", newUrl);
    if (!newUrl.includes("resumeId=")) {
      await page.screenshot({ path: "/tmp/resumer-create-fail.png" });
      throw new Error("Expected URL to include resumeId after creating resume");
    }

    // Step 4: Duplicate the current resume
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="resume-selector-button"]');
      if (btn) btn.click();
    });
    await waitForSelector(page, "[data-testid='duplicate-resume-button']");
    await delay(300);
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="duplicate-resume-button"]');
      if (btn) btn.click();
      else throw new Error("duplicate-resume-button not found in DOM");
    });
    await delay(2000);

    const dupUrl = page.url();
    console.log("Duplicated resume, URL:", dupUrl);
    if (dupUrl === newUrl) {
      await page.screenshot({ path: "/tmp/resumer-dup-fail.png" });
      throw new Error("Expected URL to change after duplicate");
    }

    // Step 5: Switch back to previous resume
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="resume-selector-button"]');
      if (btn) btn.click();
    });
    await waitForSelector(page, "[data-testid='resume-item']");
    const items = await page.$$("[data-testid='resume-item']");
    if (items.length < 2) {
      throw new Error(`Expected at least 2 resumes in dropdown, found ${items.length}`);
    }
    await page.evaluate(() => {
      const items = document.querySelectorAll('[data-testid="resume-item"]');
      if (items.length >= 2) {
        const selectBtn = items[1].querySelector("button");
        if (selectBtn) selectBtn.click();
        else throw new Error("No select button in resume item");
      } else {
        throw new Error("Not enough resume items to switch");
      }
    });
    await delay(2000);
    const switchUrl = page.url();
    console.log("Switched resume, URL:", switchUrl);
    if (switchUrl === dupUrl) {
      await page.screenshot({ path: "/tmp/resumer-switch-fail.png" });
      throw new Error("Expected URL to change after switching");
    }

    // Step 6: Delete the duplicate resume
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="resume-selector-button"]');
      if (btn) btn.click();
    });
    const deleteButtons = await page.$$("[data-testid='delete-resume-button']");
    if (deleteButtons.length < 2) {
      throw new Error(`Expected at least 2 delete buttons, found ${deleteButtons.length}`);
    }
    await page.evaluate(() => {
      const items = document.querySelectorAll('[data-testid="resume-item"]');
      if (items.length >= 2) {
        const deleteBtn = items[0].querySelector('[data-testid="delete-resume-button"]');
        if (deleteBtn) deleteBtn.click();
        else throw new Error("No delete button in resume item");
      } else {
        throw new Error("Not enough resume items to delete");
      }
    });
    await waitForSelector(page, "[data-testid='confirm-dialog']");
    await page.evaluate(() => {
      const btn = document.querySelector('[data-testid="confirm-delete-button"]');
      if (btn) btn.click();
      else throw new Error("confirm-delete-button not found");
    });
    await delay(2000);

    console.log("Delete confirmed, URL:", page.url());

    console.log("\nAll UI acceptance checks passed.");
  } catch (err) {
    console.error("UI test failed:", err);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();
