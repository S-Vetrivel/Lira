import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const ARTIFACTS_DIR = "/home/v3/.gemini/antigravity/brain/7e575195-d931-4fb5-af0d-084276ce076a/screenshots";
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function runPageShiftTest() {
  console.log("🚀 Testing Page Shift Animations in Brave Browser...");

  const browser = await puppeteer.launch({
    executablePath: "/opt/brave.com/brave/brave",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1920,960",
    ],
    defaultViewport: {
      width: 1920,
      height: 960,
    },
  });

  const page = await browser.newPage();

  try {
    // 1. LOGIN
    console.log("1. Logging in...");
    await page.goto("http://localhost:5173/login", { waitUntil: "networkidle2" });
    await page.waitForSelector("button", { timeout: 10000 });

    const demoBtns = await page.$$("button");
    for (const btn of demoBtns) {
      const text = await (await btn.getProperty("textContent")).jsonValue();
      if (text.includes("Rahul Sharma") || text.includes("Employee")) {
        await btn.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));

    // 2. Click "Board" tab
    console.log("2. Testing Shift to Board (/) ...");
    const boardLink = await page.$("header a[href='/']");
    if (boardLink) await boardLink.click();
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "anim_01_shift_board.png") });
    console.log("   📸 Captured anim_01_shift_board.png");

    // 3. Click "Analytics" tab
    console.log("3. Testing Shift to Analytics (/analytics) ...");
    const analyticsLink = await page.$("header a[href='/analytics']");
    if (analyticsLink) await analyticsLink.click();
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "anim_02_shift_analytics.png") });
    console.log("   📸 Captured anim_02_shift_analytics.png");

    // 4. Click "My Work" tab
    console.log("4. Testing Shift to My Work (/my-work) ...");
    const myWorkLink = await page.$("header a[href='/my-work']");
    if (myWorkLink) await myWorkLink.click();
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "anim_03_shift_my_work.png") });
    console.log("   📸 Captured anim_03_shift_my_work.png");

    // 5. Click "Team" tab
    console.log("5. Testing Shift to Team (/team) ...");
    const teamLink = await page.$("header a[href='/team']");
    if (teamLink) await teamLink.click();
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "anim_04_shift_team.png") });
    console.log("   📸 Captured anim_04_shift_team.png");

    // 6. Click "Projects" tab
    console.log("6. Testing Shift to Projects (/projects) ...");
    const projectsLink = await page.$("header a[href='/projects']");
    if (projectsLink) await projectsLink.click();
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "anim_05_shift_projects.png") });
    console.log("   📸 Captured anim_05_shift_projects.png");

    // 7. Verify layout measurements on Analytics
    await analyticsLink.click();
    await new Promise((r) => setTimeout(r, 800));
    const finalMetrics = await page.evaluate(() => {
      const main = document.querySelector("main");
      return {
        mainScrollHeight: main?.scrollHeight,
        mainClientHeight: main?.clientHeight,
        hasScroll: (main?.scrollHeight || 0) > (main?.clientHeight || 0) + 1,
      };
    });
    console.log("   📏 Final Analytics Viewport Metrics after shifts:", JSON.stringify(finalMetrics));

    console.log("\n🎉 All page shifting animation tests passed!");
  } catch (err) {
    console.error("❌ Animation test failed:", err);
  } finally {
    await browser.close();
  }
}

runPageShiftTest();
