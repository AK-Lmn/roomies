import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ARTIFACT_DIR = "C:/Users/ckzz2/.gemini/antigravity/brain/c639ec6f-e3fe-4f84-917e-737df01e6bab";
const WORKSPACE_SCREENSHOTS = "c:/Users/ckzz2/Downloads/grok-workspace/screenshots";

function saveScreenshot(sourcePath, destName) {
  const destPath = path.join(ARTIFACT_DIR, destName);
  fs.copyFileSync(sourcePath, destPath);
}

async function captureRadar() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Create a brand new user
  await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
  await page.click("button:has-text('Sign Up')");
  const uniqueEmail = `radar_delay_${Date.now()}@example.com`;
  await page.fill('input[placeholder="Alex"]', "RadarUser");
  await page.fill('input[placeholder="alex@example.com"]', uniqueEmail);
  await page.fill('input[placeholder="••••••••"]', "Password123!");
  await page.click('button[type="submit"]');

  await page.waitForTimeout(1000);
  if (page.url().includes("/onboarding")) {
    await page.waitForSelector('input[placeholder="sleepy_fox"]');
    await page.fill('input[placeholder="sleepy_fox"]', `rad_${Date.now().toString().slice(-5)}`);
    await page.fill('input[placeholder="Alex Rivers"]', "Radar Tester");
    await page.fill('textarea', "Testing radar pulse");
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);
  }

  // Delay the joinQueue network response
  await page.route("**/_serverFn/**", async (route) => {
    const url = route.request().url();
    const b64 = url.split("/_serverFn/")[1];
    let isRooms = false;
    try {
      const decoded = Buffer.from(b64, "base64").toString("utf-8");
      if (decoded.includes("joinQueue")) isRooms = true;
    } catch {}

    if (isRooms) {
      console.log("Delaying joinQueue server response by 4 seconds to screenshot radar...");
      await new Promise((r) => setTimeout(r, 4000));
    }
    await route.continue();
  });

  await page.goto("http://localhost:8080/match", { waitUntil: "networkidle" });
  await page.click("button:has-text('Look for roommates')");
  
  // Wait for radar elements to appear
  await page.waitForSelector("text=Finding your room…", { timeout: 3000 });
  await page.waitForTimeout(1000);

  const matchRadarShot = path.join(WORKSPACE_SCREENSHOTS, "06_match_radar_animation.png");
  await page.screenshot({ path: matchRadarShot });
  saveScreenshot(matchRadarShot, "06_match_radar_animation.png");
  console.log("Radar animation screenshot captured successfully!");

  await browser.close();
}

captureRadar();
