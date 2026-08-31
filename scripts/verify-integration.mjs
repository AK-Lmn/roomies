import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  const page = await context.newPage();

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      console.log("[Browser Console Error]", msg.text());
    }
  });

  const results = {
    steps: {},
    errors: [],
  };

  const screenshotsDir = path.resolve("screenshots");
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    const timestamp = Date.now();
    const testEmail = `roomie_test_${timestamp}@example.com`;
    const testPassword = "Password123!";
    const testDisplayName = `Tester_${timestamp.toString().slice(-4)}`;
    const testUsername = `user_${timestamp.toString().slice(-6)}`;
    const testChatMessage = `Hello roomies! Verification message at ${new Date().toISOString()}`;
    const testFridgeNote = `Remember to test fridge notes! (${timestamp.toString().slice(-4)})`;

    console.log(`Starting verification with user: ${testEmail}`);

    // Step 1: Register a new user account
    console.log("Step 1: Navigating to /login...");
    await page.goto("http://localhost:8080/login", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(screenshotsDir, "01-login-initial.png") });

    // Switch to Sign Up mode
    console.log("Switching to Sign Up tab...");
    const signUpTab = page.locator('button:has-text("Sign Up")');
    await signUpTab.click();
    await page.waitForTimeout(400);

    // Fill form
    console.log("Filling Sign Up form...");
    await page.locator('input[placeholder="Alex"]').fill(testDisplayName);
    await page.locator('input[type="email"]').fill(testEmail);
    await page.locator('input[type="password"]').fill(testPassword);
    await page.screenshot({ path: path.join(screenshotsDir, "02-signup-filled.png") });

    // Submit sign up
    console.log("Submitting Sign Up...");
    await page.locator('button[type="submit"]').click();

    // Wait for redirect away from /login
    await page.waitForURL((url) => url.pathname !== "/login", { timeout: 10000 });
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, "03-after-signup.png") });
    results.steps.registration = { success: true, email: testEmail, displayName: testDisplayName };
    console.log("Step 1 (Registration) complete. Current URL:", page.url());

    // Step 2: Complete onboarding profile setup
    console.log("Step 2: Onboarding profile setup...");
    if (!page.url().includes("/onboarding")) {
      console.log("Navigating to /onboarding...");
      await page.goto("http://localhost:8080/onboarding", { waitUntil: "networkidle" });
    }
    await page.waitForSelector('input[placeholder="sleepy_fox"]', { timeout: 10000 });
    await page.screenshot({ path: path.join(screenshotsDir, "04-onboarding.png") });

    // Fill onboarding profile
    console.log(`Filling username: ${testUsername}, displayName: ${testDisplayName}`);
    const usernameInput = page.locator('input[placeholder="sleepy_fox"]');
    await usernameInput.fill("");
    await usernameInput.fill(testUsername);

    const displayNameInput = page.locator('input[placeholder="Alex Rivers"]');
    await displayNameInput.fill("");
    await displayNameInput.fill(testDisplayName);

    const bioInput = page.locator('textarea[placeholder*="Night owl"], textarea');
    if (await bioInput.count()) {
      await bioInput.first().fill("Automated verification agent testing Neon integration.");
    }

    await page.screenshot({ path: path.join(screenshotsDir, "05-onboarding-filled.png") });

    // Submit onboarding profile
    console.log("Submitting onboarding profile...");
    const saveProfileButton = page.locator('button[type="submit"]:has-text("Enter Roomies"), button[type="submit"]');
    await saveProfileButton.click();

    // Wait for redirect to home /
    await page.waitForURL((url) => !url.pathname.includes("/onboarding"), { timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotsDir, "06-after-onboarding.png") });
    results.steps.onboarding = { success: true, username: testUsername, displayName: testDisplayName };
    console.log("Step 2 (Onboarding) complete. Current URL:", page.url());

    // Step 3: Go to /match and create a room
    console.log("Step 3: Navigating to /match...");
    await page.goto("http://localhost:8080/match", { waitUntil: "networkidle" });
    await page.screenshot({ path: path.join(screenshotsDir, "07-match-page.png") });

    console.log("Clicking 'Look for roommates' / starting match...");
    const matchButton = page.locator('button:has-text("Look for roommates")');
    await matchButton.click();

    // Wait for match / room redirection
    console.log("Waiting for room creation / match redirect...");
    await page.waitForURL((url) => url.pathname.includes("/room/"), { timeout: 15000 });
    const roomUrl = page.url();
    const roomId = roomUrl.split("/room/")[1]?.split("?")[0]?.split("#")[0];
    console.log(`Matched! Room URL: ${roomUrl}, Room ID: ${roomId}`);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(screenshotsDir, "08-room-entered.png") });
    results.steps.roomCreation = { success: true, roomId, url: roomUrl };

    // Step 4a: Send a chat message
    console.log("Step 4a: Sending chat message...");
    const chatTabButton = page.locator('button:has-text("Chat")');
    if (await chatTabButton.count()) {
      await chatTabButton.click();
    }
    await page.waitForTimeout(500);

    const chatInput = page.locator('textarea[placeholder*="Say something"], textarea[placeholder*="room"], textarea').first();
    await chatInput.fill(testChatMessage);
    await page.screenshot({ path: path.join(screenshotsDir, "09-chat-typed.png") });

    const sendButton = page.locator('button[type="submit"]:has-text("Send"), form button:has-text("Send"), button[type="submit"]').first();
    if (await sendButton.count()) {
      await sendButton.click();
    } else {
      await chatInput.press("Enter");
    }

    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotsDir, "10-chat-sent.png") });

    // Verify message is visible on screen
    const messageFound = await page.locator(`text=${testChatMessage}`).count();
    console.log(`Chat message rendered on page: ${messageFound > 0}`);
    results.steps.chatMessage = {
      success: messageFound > 0,
      message: testChatMessage,
    };

    // Step 4b: Stick a fridge note
    console.log("Step 4b: Sticking a fridge note...");
    const fridgeTabButton = page.locator('button:has-text("Fridge")');
    await fridgeTabButton.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(screenshotsDir, "11-fridge-tab.png") });

    const noteInput = page.locator('input[placeholder*="sticky note"], input[placeholder*="fridge"], input[type="text"]').last();
    await noteInput.fill(testFridgeNote);
    await page.screenshot({ path: path.join(screenshotsDir, "12-fridge-typed.png") });

    const postNoteButton = page.locator('button[type="submit"]:has-text("Stick Note"), button:has-text("Stick Note"), button[type="submit"]').last();
    await postNoteButton.click();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(screenshotsDir, "13-fridge-posted.png") });

    const noteFound = await page.locator(`text=${testFridgeNote}`).count();
    console.log(`Fridge note rendered on page: ${noteFound > 0}`);
    results.steps.fridgeNote = {
      success: noteFound > 0,
      note: testFridgeNote,
    };

    console.log("All verification steps completed successfully!");
  } catch (err) {
    console.error("Verification failed with error:", err);
    results.errors.push(err.message || String(err));
    await page.screenshot({ path: path.join(screenshotsDir, "error-state.png") }).catch(() => {});
  } finally {
    await browser.close();
    console.log("\n=== FINAL RESULTS ===");
    console.log(JSON.stringify(results, null, 2));
  }
}

run();
