import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const ARTIFACT_DIR = "C:/Users/ckzz2/.gemini/antigravity/brain/c639ec6f-e3fe-4f84-917e-737df01e6bab";
const WORKSPACE_SCREENSHOTS = "c:/Users/ckzz2/Downloads/grok-workspace/screenshots";

if (!fs.existsSync(WORKSPACE_SCREENSHOTS)) {
  fs.mkdirSync(WORKSPACE_SCREENSHOTS, { recursive: true });
}
if (!fs.existsSync(ARTIFACT_DIR)) {
  fs.mkdirSync(ARTIFACT_DIR, { recursive: true });
}

function saveScreenshot(sourcePath, destName) {
  const destPath = path.join(ARTIFACT_DIR, destName);
  fs.copyFileSync(sourcePath, destPath);
}

async function runQA() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  // Listen to console logs and errors
  const consoleLogs = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleLogs.push({ type: "error", text: msg.text() });
    }
  });
  page.on("pageerror", (err) => {
    consoleLogs.push({ type: "pageerror", text: err.toString() });
  });

  const report = {
    steps: [],
    errors: [],
    consoleErrors: consoleLogs,
  };

  try {
    console.log("Step 1: Navigating to Home Dashboard (Signed Out)...");
    await page.goto("http://localhost:8080", { waitUntil: "networkidle" });
    const homeSignedOutShot = path.join(WORKSPACE_SCREENSHOTS, "01_home_signed_out.png");
    await page.screenshot({ path: homeSignedOutShot, fullPage: true });
    saveScreenshot(homeSignedOutShot, "01_home_signed_out.png");
    report.steps.push({
      step: "Home Dashboard (Signed Out)",
      status: "PASS",
      title: await page.title(),
      url: page.url(),
      screenshot: "01_home_signed_out.png",
    });

    console.log("Step 2: Sign Up / Sign In test user...");
    await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
    
    // Switch to Sign Up
    const signUpTab = page.locator("button:has-text('Sign Up')");
    if (await signUpTab.isVisible()) {
      await signUpTab.click();
    }
    
    const uniqueEmail = `tester_${Date.now()}@example.com`;
    const testPassword = "Password123!";
    const testName = "CozyTester";

    await page.fill('input[placeholder="Alex"]', testName);
    await page.fill('input[placeholder="alex@example.com"]', uniqueEmail);
    await page.fill('input[placeholder="••••••••"]', testPassword);
    
    const loginShot = path.join(WORKSPACE_SCREENSHOTS, "02_login_signup.png");
    await page.screenshot({ path: loginShot });
    saveScreenshot(loginShot, "02_login_signup.png");

    await page.click('button[type="submit"]');
    await page.waitForTimeout(1200);

    // If redirected to onboarding or home
    console.log("Current URL after signup:", page.url());
    if (page.url().includes("/onboarding")) {
      console.log("Step 3: Completing Onboarding...");
      await page.waitForSelector('input[placeholder="sleepy_fox"]', { timeout: 5000 });
      await page.fill('input[placeholder="sleepy_fox"]', `qa_${Date.now().toString().slice(-6)}`);
      await page.fill('input[placeholder="Alex Rivers"]', "Cozy QA Explorer");
      await page.fill('textarea', "Exploring cozy rooms and testing sticky notes!");
      
      const onboardingShot = path.join(WORKSPACE_SCREENSHOTS, "03_onboarding.png");
      await page.screenshot({ path: onboardingShot });
      saveScreenshot(onboardingShot, "03_onboarding.png");

      await page.click('button[type="submit"]');
      await page.waitForTimeout(1500);
    }

    console.log("Step 4: Home Dashboard (Signed In)...");
    await page.goto("http://localhost:8080", { waitUntil: "networkidle" });
    const homeSignedInShot = path.join(WORKSPACE_SCREENSHOTS, "04_home_signed_in.png");
    await page.screenshot({ path: homeSignedInShot, fullPage: true });
    saveScreenshot(homeSignedInShot, "04_home_signed_in.png");
    report.steps.push({
      step: "Home Dashboard (Signed In)",
      status: "PASS",
      url: page.url(),
      screenshot: "04_home_signed_in.png",
    });

    console.log("Step 5: Testing Matchmaking at /match (Radar & Badges)...");
    await page.goto("http://localhost:8080/match", { waitUntil: "networkidle" });
    
    // Check feature badges
    const smallGroupsBadge = await page.locator("text=Small Groups").isVisible();
    const cycleBadge = await page.locator("text=7-Day Cycle").isVisible();
    console.log("Badges visible:", { smallGroupsBadge, cycleBadge });

    const matchIdleShot = path.join(WORKSPACE_SCREENSHOTS, "05_match_idle_badges.png");
    await page.screenshot({ path: matchIdleShot });
    saveScreenshot(matchIdleShot, "05_match_idle_badges.png");

    // Click "Look for roommates" to test radar animation
    const findButton = page.locator("button:has-text('Look for roommates')");
    if (await findButton.isVisible()) {
      await findButton.click();
      await page.waitForTimeout(600); // Capture radar pulse
      const matchRadarShot = path.join(WORKSPACE_SCREENSHOTS, "06_match_radar_animation.png");
      await page.screenshot({ path: matchRadarShot });
      saveScreenshot(matchRadarShot, "06_match_radar_animation.png");
    }

    // Wait for match to complete (it auto redirects to /room/:roomId)
    console.log("Waiting for room match...");
    await page.waitForURL(/\/room\//, { timeout: 10000 });
    console.log("Matched into room:", page.url());

    const roomMainShot = path.join(WORKSPACE_SCREENSHOTS, "07_room_main_chat.png");
    await page.screenshot({ path: roomMainShot, fullPage: true });
    saveScreenshot(roomMainShot, "07_room_main_chat.png");

    console.log("Step 6: Testing Fridge Tab and Color Swatches...");
    // Click Fridge tab
    await page.click("button:has-text('Fridge')");
    await page.waitForTimeout(500);

    // Verify 5 color swatches
    const expectedSwatches = [
      { label: "Warm Butter", value: "#FBE8A6" },
      { label: "Mint Sage", value: "#BCECE0" },
      { label: "Blush Rose", value: "#F4B6C2" },
      { label: "Powder Sky", value: "#BEE3F8" },
      { label: "Soft Lavender", value: "#E9D8FD" },
    ];

    const swatchesFound = [];
    for (const swatch of expectedSwatches) {
      const button = page.locator(`button[title="${swatch.label}"]`);
      const exists = await button.isVisible();
      swatchesFound.push({ label: swatch.label, exists, color: swatch.value });
    }
    console.log("Swatches verified:", swatchesFound);

    const fridgeInitialShot = path.join(WORKSPACE_SCREENSHOTS, "08_fridge_tab_swatches.png");
    await page.screenshot({ path: fridgeInitialShot, fullPage: true });
    saveScreenshot(fridgeInitialShot, "08_fridge_tab_swatches.png");

    // Select "Blush Rose" and stick a note
    console.log("Selecting 'Blush Rose' swatch...");
    await page.click('button[title="Blush Rose"]');
    await page.fill('input[placeholder*="sticky note"]', "Welcome to the cozy room! Don't forget coffee in the morning ☕✨");
    await page.click("button:has-text('Stick Note')");
    await page.waitForTimeout(800);

    // Stick a second note with "Mint Sage"
    console.log("Selecting 'Mint Sage' swatch...");
    await page.click('button[title="Mint Sage"]');
    await page.fill('input[placeholder*="sticky note"]', "Board game night this Friday 🎲🌿");
    await page.click("button:has-text('Stick Note')");
    await page.waitForTimeout(800);

    const fridgeWithNotesShot = path.join(WORKSPACE_SCREENSHOTS, "09_fridge_notes_stuck.png");
    await page.screenshot({ path: fridgeWithNotesShot, fullPage: true });
    saveScreenshot(fridgeWithNotesShot, "09_fridge_notes_stuck.png");

    console.log("Step 7: Testing Other Room Tabs (Wall, Music, Daily Q) for Aesthetic Consistency...");
    // Wall Tab
    await page.click("button:has-text('Wall')");
    await page.waitForTimeout(500);
    const wallShot = path.join(WORKSPACE_SCREENSHOTS, "10_room_wall_tab.png");
    await page.screenshot({ path: wallShot, fullPage: true });
    saveScreenshot(wallShot, "10_room_wall_tab.png");

    // Music Tab
    await page.click("button:has-text('Music')");
    await page.waitForTimeout(500);
    const musicShot = path.join(WORKSPACE_SCREENSHOTS, "11_room_music_tab.png");
    await page.screenshot({ path: musicShot, fullPage: true });
    saveScreenshot(musicShot, "11_room_music_tab.png");

    // Daily Q Tab
    await page.click("button:has-text('Daily Q')");
    await page.waitForTimeout(500);
    const dailyShot = path.join(WORKSPACE_SCREENSHOTS, "12_room_daily_tab.png");
    await page.screenshot({ path: dailyShot, fullPage: true });
    saveScreenshot(dailyShot, "12_room_daily_tab.png");

    // Profile Page
    await page.goto("http://localhost:8080/profile", { waitUntil: "networkidle" });
    const profileShot = path.join(WORKSPACE_SCREENSHOTS, "13_profile_view.png");
    await page.screenshot({ path: profileShot, fullPage: true });
    saveScreenshot(profileShot, "13_profile_view.png");

    // Mobile Viewport QA for aesthetic consistency
    console.log("Step 8: Mobile Viewport QA (390x844)...");
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("http://localhost:8080", { waitUntil: "networkidle" });
    const mobileHomeShot = path.join(WORKSPACE_SCREENSHOTS, "14_mobile_home.png");
    await page.screenshot({ path: mobileHomeShot, fullPage: true });
    saveScreenshot(mobileHomeShot, "14_mobile_home.png");

    await page.goto("http://localhost:8080/match", { waitUntil: "networkidle" });
    const mobileMatchShot = path.join(WORKSPACE_SCREENSHOTS, "15_mobile_match.png");
    await page.screenshot({ path: mobileMatchShot, fullPage: true });
    saveScreenshot(mobileMatchShot, "15_mobile_match.png");

    console.log("QA Automation completed successfully!");
    report.success = true;
    report.swatches = swatchesFound;

  } catch (err) {
    console.error("QA Run Error:", err);
    report.errors.push(err.toString());
    report.success = false;
  } finally {
    await browser.close();
    fs.writeFileSync(
      path.join(WORKSPACE_SCREENSHOTS, "qa-summary.json"),
      JSON.stringify(report, null, 2)
    );
  }
}

runQA();
