import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage();

  page.on("console", (msg) => console.log("[BROWSER]", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.error("[BROWSER ERROR]", err));

  const screenshotsDir = path.resolve(process.cwd(), "screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  const results = {
    steps: [],
    success: true,
  };

  try {
    console.log("Step 1: Navigating to login...");
    await page.goto("http://127.0.0.1:8080/login", { waitUntil: "networkidle" });

    // Sign up a unique test user
    const rand = Math.floor(Math.random() * 90000) + 10000;
    const testEmail = `qa_music_${rand}@example.com`;
    const testPass = "password123";

    console.log("Switching to Sign Up...");
    await page.click("button:has-text('Sign Up')");
    await page.waitForTimeout(300);
    await page.fill("input[placeholder='Alex']", `QA Music ${rand}`);
    await page.fill("input[type='email']", testEmail);
    await page.fill("input[type='password']", testPass);
    await page.click("button[type='submit']:has-text('Create Account')");

    await page.waitForTimeout(2000);

    // If redirected to onboarding
    if (page.url().includes("/onboarding")) {
      console.log("Onboarding detected. Waiting for form...");
      await page.waitForSelector("input[placeholder='sleepy_fox']", { timeout: 10000 });
      await page.fill("input[placeholder='sleepy_fox']", `qa_${rand}`);
      await page.fill("input[placeholder='Your name']", `QA Tester ${rand}`);
      await page.click("button[type='submit']:has-text('Continue')");
      await page.waitForTimeout(2000);
    }

    console.log("Current URL after auth:", page.url());

    // If on home or match page, enter or find room
    if (!page.url().includes("/room/")) {
      console.log("Finding/entering a room...");
      await page.goto("http://127.0.0.1:8080/match", { waitUntil: "networkidle" });
      const lookBtn = page.locator("button:has-text('Look for roommates')");
      if (await lookBtn.isVisible()) {
        await lookBtn.click();
      }
      console.log("Waiting for match / room entry...");
      await page.waitForURL(/\/room\/.+/, { timeout: 20000 });
    }

    console.log("Successfully entered room:", page.url());
    results.steps.push({ step: "1. Enter Room", url: page.url(), status: "passed" });

    // Switch to Music Tab
    console.log("Switching to Music tab...");
    const musicTabBtn = page.locator("button:has-text('music')");
    await musicTabBtn.waitFor({ state: "visible" });
    await musicTabBtn.click();
    await page.waitForTimeout(1000);

    // --- Step 3: Instant Search ---
    console.log("Testing Instant Search for 'Daft Punk'...");
    const searchInput = page.locator("input[placeholder*='Search any song']");
    await searchInput.waitFor({ state: "visible" });
    await searchInput.fill("Daft Punk");

    // Wait for search results dropdown
    console.log("Waiting for instant search results dropdown...");
    const dropdown = page.locator("div.absolute.z-30");
    await dropdown.waitFor({ state: "visible", timeout: 10000 });
    console.log("Search dropdown visible!");

    // Wait for at least one search result item
    const firstResult = dropdown.locator("div.flex.items-center.justify-between").first();
    await firstResult.waitFor({ state: "visible", timeout: 8000 });

    // Capture Screenshot 1: Search Results Dropdown
    const shot1 = path.join(screenshotsDir, "qa_01_instant_search_dropdown.png");
    await page.screenshot({ path: shot1 });
    console.log("Captured:", shot1);
    results.steps.push({ step: "2. Instant Search Dropdown", screenshot: shot1, status: "passed" });

    // Click "+ Add" on the first search result
    console.log("Adding Daft Punk track from search results...");
    const addBtn = firstResult.locator("button:has-text('+ Add')");
    await addBtn.click();
    await page.waitForTimeout(2000);

    // --- Step 4: Smart Paste (Spotify link) ---
    console.log("Testing Smart Paste with Spotify link...");
    const pasteTabBtn = page.locator("button:has-text('Paste Link')");
    await pasteTabBtn.click();
    await page.waitForTimeout(500);

    const pasteInput = page.locator("input[placeholder*='Paste Spotify track']");
    const spotifyUrl = "https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT"; // Rick Astley
    await pasteInput.fill(spotifyUrl);

    // Wait for auto-fetch metadata
    console.log("Waiting for Spotify metadata auto-fetch...");
    const resolvedMeta = page.locator("text=Never Gonna Give You Up");
    await resolvedMeta.waitFor({ state: "visible", timeout: 12000 });
    console.log("Spotify metadata fetched successfully!");

    // Click "+ Add Song" button
    const submitSongBtn = page.locator("button[type='submit']:has-text('+ Add Song')");
    await submitSongBtn.click();
    await page.waitForTimeout(2000);

    // Capture Screenshot 2: Room Playlist with added songs
    const shot2 = path.join(screenshotsDir, "qa_02_added_songs_playlist.png");
    await page.screenshot({ path: shot2 });
    console.log("Captured:", shot2);
    results.steps.push({ step: "3. Smart Paste & Room Playlist", screenshot: shot2, status: "passed" });

    // --- Step 5: Expanded Player ---
    console.log("Testing expanded player...");
    // Find player toggle buttons
    const playerToggles = page.locator("button:has-text('Play in Room')");
    const count = await playerToggles.count();
    console.log(`Found ${count} player toggle buttons in playlist.`);

    // Expand the first player (Spotify embed)
    if (count > 0) {
      await playerToggles.first().click();
      await page.waitForTimeout(2000);
    }

    // Expand second player if available (YouTube embed)
    if (count > 1) {
      await playerToggles.nth(1).click();
      await page.waitForTimeout(2000);
    }

    // Wait for iframe to be attached
    const playerIframe = page.locator("iframe").first();
    await playerIframe.waitFor({ state: "visible", timeout: 8000 });
    console.log("Player iframe loaded and visible!");

    // Capture Screenshot 3: Expanded Media Player
    const shot3 = path.join(screenshotsDir, "qa_03_expanded_player.png");
    await page.screenshot({ path: shot3 });
    console.log("Captured:", shot3);
    results.steps.push({ step: "4. Expanded Media Player", screenshot: shot3, status: "passed" });

    console.log("All Music QA tests completed successfully!");
  } catch (err) {
    console.error("QA error:", err);
    results.success = false;
    results.error = err.message;
    const errShot = path.join(screenshotsDir, "qa_error.png");
    await page.screenshot({ path: errShot }).catch(() => {});
  } finally {
    await browser.close();
  }

  console.log("=== FINAL QA VERDICT ===");
  console.log(JSON.stringify(results, null, 2));
}

run();
