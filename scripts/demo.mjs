/**
 * Constellation — automated video demo (Playwright).
 *
 * Drives the running app through a guided story and records a .webm video.
 * Prereqs: the app must be running (`npm run dev`) and Playwright + Chromium
 * installed (`npm i -D playwright && npx playwright install chromium`).
 *
 *   npm run demo
 *
 * Env:
 *   APP_URL      default http://localhost:5173/
 *   DEMO_WIDTH   default 3840   (output video width  — 4K UHD by default)
 *   DEMO_HEIGHT  default 2160   (output video height)
 *   DEMO_SCALE   default 2      (the page is laid out at WIDTH/SCALE so the UI stays a
 *                                comfortable, readable size, then rendered at full output res)
 *   DEMO_SPEED   default 1      (1 = normal, 2 = 2x faster)
 */

import { chromium } from "playwright";
import { mkdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP_URL = process.env.APP_URL ?? "http://localhost:5173/";
const OUT_DIR = join(root, "demo");
const RAW_DIR = join(OUT_DIR, "_raw");
const FINAL = join(OUT_DIR, "constellation-demo.webm");
// Output (video file) resolution.
const OUT_W = Number(process.env.DEMO_WIDTH ?? 3840) || 3840;
const OUT_H = Number(process.env.DEMO_HEIGHT ?? 2160) || 2160;
// The page is laid out at 1/SCALE of the output, then rendered at SCALE device pixels.
// This keeps the UI a readable 1080p-equivalent size while the file itself is true 4K.
const SCALE = Number(process.env.DEMO_SCALE ?? 2) || 2;
const VW = Math.round(OUT_W / SCALE);
const VH = Math.round(OUT_H / SCALE);
const SPEED = Number(process.env.DEMO_SPEED ?? 1) || 1;
const s = (ms) => Math.max(1, Math.round(ms / SPEED));

mkdirSync(RAW_DIR, { recursive: true });

const browser = await chromium.launch({
  args: ["--force-color-profile=srgb", "--high-dpi-support=1", `--force-device-scale-factor=${SCALE}`],
});
const context = await browser.newContext({
  viewport: { width: VW, height: VH },
  deviceScaleFactor: SCALE,
  recordVideo: { dir: RAW_DIR, size: { width: OUT_W, height: OUT_H } },
});
const page = await context.newPage();
page.setDefaultTimeout(25_000);
const video = page.video();

const pause = (ms) => page.waitForTimeout(s(ms));

async function caption(text) {
  await page.evaluate((t) => {
    let el = document.getElementById("demo-caption");
    if (!el) {
      el = document.createElement("div");
      el.id = "demo-caption";
      el.style.cssText =
        "position:fixed;left:50%;bottom:34px;transform:translateX(-50%);z-index:99999;" +
        "background:rgba(13,17,23,.88);color:#e6edf3;border:1px solid #30363d;border-radius:999px;" +
        "padding:13px 28px;font:600 19px Inter,system-ui,sans-serif;letter-spacing:.2px;" +
        "box-shadow:0 8px 30px rgba(0,0,0,.55);backdrop-filter:blur(6px);transition:opacity .35s ease;";
      document.body.appendChild(el);
    }
    el.textContent = t;
    el.style.opacity = "1";
  }, text);
}

async function clearCaption() {
  await page.evaluate(() => {
    const el = document.getElementById("demo-caption");
    if (el) el.style.opacity = "0";
  });
}

/** Trigger an action and wait for the resulting /api/query response + render. */
async function runQuery(trigger) {
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/query") && r.request().method() === "POST",
      { timeout: 25_000 },
    ),
    trigger(),
  ]);
  await page.waitForSelector(".story-title", { state: "visible" });
  await page.waitForSelector(".action-card", { state: "visible" }).catch(() => {});
}

try {
  await page.goto(APP_URL, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".graph-host canvas", { state: "visible" });
  await pause(2600); // let the constellation settle into place

  await caption("Constellation — turn scattered expertise into a living map you can ask");
  await pause(3400);

  // 1 — Ask one question
  const input = page.locator(".prompt-input");
  await input.click();
  await caption("Ask one question of your whole portfolio");
  await input.pressSequentially("Which customers likely share backup-restore risk patterns?", {
    delay: s(34),
  });
  await pause(500);
  await runQuery(() => page.locator(".run-btn").click());
  await caption("Pattern Hunt reveals a risk shared across three customers");
  await pause(4200);

  // A gentle, centered nudge — keep the whole constellation comfortably in frame.
  const host = await page.locator(".graph-host").boundingBox();
  if (host) {
    await page.mouse.move(host.x + host.width * 0.5, host.y + host.height * 0.5);
    await page.mouse.wheel(0, -80);
  }
  await pause(2600);

  await caption("Every claim is source-grounded with a confidence label");
  await pause(3800);

  // 2 — Executive Story (same data, new lens)
  await caption("Same map, a new lens → Executive Story");
  await runQuery(() => page.locator(".mode-btn", { hasText: "Executive Story" }).click());
  await pause(5200);

  // 3 — Playbook Remix
  await caption("Playbook Remix → reuse a proven fix on a new customer");
  await runQuery(() => page.locator(".mode-btn", { hasText: "Playbook Remix" }).click());
  await pause(5200);

  // 4 — Repeated-but-untracked recommendations
  await runQuery(() => page.locator(".mode-btn", { hasText: "Pattern Hunt" }).click());
  await pause(700);
  await caption("Which proven recommendations were never turned into actions?");
  await runQuery(() =>
    page.locator(".example-chip", { hasText: "repeated recommendations" }).click(),
  );
  await pause(5200);

  // 5 — Safe-demo redaction
  await caption("Safe-demo mode masks owners before you share");
  await runQuery(() => page.locator(".safe-toggle input").check());
  await pause(4600);

  // Outro
  await caption("Constellation · Foundry IQ · Work IQ · Fabric IQ");
  await pause(3600);
  await clearCaption();
  await pause(900);
} finally {
  await context.close();
  await browser.close();
}

const raw = await video.path();
renameSync(raw, FINAL);
rmSync(RAW_DIR, { recursive: true, force: true });
console.log(`\n  Demo video saved -> ${FINAL}\n`);
