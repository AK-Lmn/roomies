import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function inspectRoomHeader() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  const consoleLogs = [];
  const networkRequests = [];
  const errors = [];

  page.on("console", (msg) => {
    const text = msg.text();
    const type = msg.type();
    consoleLogs.push({ type, text, timestamp: Date.now() });
    console.log(`[BROWSER ${type}]`, text);
  });

  page.on("pageerror", (err) => {
    errors.push({ err: err.message, stack: err.stack, timestamp: Date.now() });
    console.error("[PAGE ERROR]", err);
  });

  page.on("request", (req) => {
    const url = req.url();
    if (url.includes("/api/")) {
      networkRequests.push({ url, method: req.method(), timestamp: Date.now() });
    }
  });

  const screenshotsDir = path.resolve(process.cwd(), "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    console.log("Navigating to http://localhost:8080/login...");
    await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });

    const rand = Math.floor(Math.random() * 90000) + 10000;
    const testEmail = `inspector_${rand}@example.com`;
    const testPass = "password123";

    console.log("Switching to Sign Up...");
    await page.click("button:has-text('Sign Up')");
    await page.waitForTimeout(300);
    await page.fill("input[placeholder='Alex']", `Inspector ${rand}`);
    await page.fill("input[type='email']", testEmail);
    await page.fill("input[type='password']", testPass);
    await page.click("button[type='submit']:has-text('Create Account')");

    await page.waitForTimeout(2000);

    if (page.url().includes("/onboarding")) {
      console.log("Onboarding detected. Completing onboarding form...");
      await page.waitForSelector("input[placeholder='sleepy_fox']", { timeout: 10000 });
      await page.fill("input[placeholder='sleepy_fox']", `inspector_${rand}`);
      await page.fill("input[placeholder='Your name']", `Inspector ${rand}`);
      await page.click("button[type='submit']:has-text('Continue')");
      await page.waitForTimeout(2000);
    }

    console.log("Current URL after auth:", page.url());

    if (!page.url().includes("/room/")) {
      console.log("Navigating to /match...");
      await page.goto("http://localhost:8080/match", { waitUntil: "networkidle" });
      const lookBtn = page.locator("button:has-text('Look for roommates')");
      if (await lookBtn.isVisible()) {
        await lookBtn.click();
      }
      console.log("Waiting for room navigation...");
      await page.waitForURL(/\/room\/.+/, { timeout: 20000 });
    }

    const roomUrl = page.url();
    console.log("Entered Room:", roomUrl);

    await page.waitForTimeout(2000);

    const header = page.locator("header").first();
    await header.waitFor({ state: "visible", timeout: 10000 });

    const roomTitleEl = header.locator("span.font-semibold").first();
    const roomTitle = await roomTitleEl.innerText();
    console.log("Room Title text:", roomTitle);

    const p2pBadge = header.locator("span.rounded-full").first();
    const p2pBadgeText = await p2pBadge.innerText();
    const p2pBadgeTitle = await p2pBadge.getAttribute("title");
    console.log("P2P Badge text:", p2pBadgeText);
    console.log("P2P Badge tooltip:", p2pBadgeTitle);

    console.log("Monitoring header and P2P badge for 8 seconds to verify stability...");
    const stateSamples = [];
    const sampleStartTime = Date.now();
    for (let i = 0; i < 16; i++) {
      await page.waitForTimeout(500);
      const text = await p2pBadge.innerText();
      const title = await p2pBadge.getAttribute("title");
      stateSamples.push({ elapsed: Date.now() - sampleStartTime, text, title });
    }

    console.log("State samples over 8 seconds:", JSON.stringify(stateSamples, null, 2));

    const fullPageShot = path.join(screenshotsDir, "room_full_page.png");
    await page.screenshot({ path: fullPageShot });
    console.log("Saved full page screenshot:", fullPageShot);

    const headerShot = path.join(screenshotsDir, "room_header.png");
    await header.screenshot({ path: headerShot });
    console.log("Saved header screenshot:", headerShot);

    const topLeftShot = path.join(screenshotsDir, "room_top_left_header.png");
    const headerBox = await header.boundingBox();
    if (headerBox) {
      await page.screenshot({
        path: topLeftShot,
        clip: {
          x: headerBox.x,
          y: headerBox.y,
          width: Math.min(headerBox.width, 500),
          height: headerBox.height,
        },
      });
      console.log("Saved top-left header screenshot:", topLeftShot);
    }

    const uniqueBadgeTexts = [...new Set(stateSamples.map((s) => s.text))];
    const rtcPollRequests = networkRequests.filter((r) => r.url.includes("/api/rtc"));
    console.log("Unique badge texts observed:", uniqueBadgeTexts);
    console.log("Total RTC requests during test:", rtcPollRequests.length);
    console.log("Browser errors during test:", errors.length);

    const report = {
      roomUrl,
      roomTitle,
      p2pBadgeText,
      p2pBadgeTitle,
      uniqueBadgeTexts,
      stateSamplesCount: stateSamples.length,
      rtcRequestsCount: rtcPollRequests.length,
      errorsCount: errors.length,
      errors,
      screenshots: {
        fullPage: fullPageShot,
        header: headerShot,
        topLeft: topLeftShot,
      },
    };

    fs.writeFileSync(
      path.join(screenshotsDir, "inspection_report.json"),
      JSON.stringify(report, null, 2),
      "utf-8"
    );

    console.log("Inspection completed successfully!");
  } catch (err) {
    console.error("Inspection error:", err);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

inspectRoomHeader();
