import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const ARTIFACTS_DIR = "/home/v3/.gemini/antigravity/brain/7e575195-d931-4fb5-af0d-084276ce076a/screenshots";
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

const VIEWPORTS = [
  { name: "1080p_desktop", width: 1920, height: 920, label: "1920x920 (Desktop 1080p inner window)" },
  { name: "macbook_laptop", width: 1440, height: 820, label: "1440x820 (MacBook/Laptop inner window)" },
  { name: "compact_laptop", width: 1366, height: 700, label: "1366x700 (Compact Laptop inner window)" },
  { name: "tablet_landscape", width: 1024, height: 768, label: "1024x768 (Tablet Landscape)" },
  { name: "mobile_portrait", width: 390, height: 844, label: "390x844 (Mobile Portrait iPhone)" },
];

async function runResponsiveTests() {
  console.log("🚀 Testing Responsive Viewports in Brave Browser...");

  const browser = await puppeteer.launch({
    executablePath: "/opt/brave.com/brave/brave",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  const page = await browser.newPage();

  try {
    // 1. Initial Login
    await page.setViewport({ width: 1920, height: 920 });
    await page.goto("http://localhost:5173/login", { waitUntil: "networkidle2" });
    await page.waitForSelector("button", { timeout: 10000 });

    // Click demo employee
    const demoBtns = await page.$$("button");
    for (const btn of demoBtns) {
      const text = await (await btn.getProperty("textContent")).jsonValue();
      if (text.includes("Rahul Sharma") || text.includes("Employee")) {
        await btn.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));

    // 2. Test each viewport on /analytics
    for (const vp of VIEWPORTS) {
      console.log(`\n📐 Testing Viewport: ${vp.label} ...`);
      await page.setViewport({ width: vp.width, height: vp.height });
      await page.goto("http://localhost:5173/analytics", { waitUntil: "networkidle2" });
      await new Promise((r) => setTimeout(r, 1200));

      // Measure scrollHeight vs clientHeight on main/container
      const scrollMetrics = await page.evaluate(() => {
        const main = document.querySelector("main");
        const analyticsDiv = main?.firstElementChild;
        return {
          windowInnerHeight: window.innerHeight,
          windowInnerWidth: window.innerWidth,
          mainClientHeight: main?.clientHeight,
          mainScrollHeight: main?.scrollHeight,
          analyticsClientHeight: analyticsDiv?.clientHeight,
          analyticsScrollHeight: analyticsDiv?.scrollHeight,
          hasVerticalScroll: (analyticsDiv?.scrollHeight || 0) > (analyticsDiv?.clientHeight || 0) + 2,
        };
      });

      console.log(`   📏 Metrics for ${vp.name}:`, JSON.stringify(scrollMetrics));

      const screenshotPath = path.join(ARTIFACTS_DIR, `responsive_${vp.name}.png`);
      await page.screenshot({ path: screenshotPath });
      console.log(`   📸 Saved screenshot: ${screenshotPath}`);
    }

    // Also test light theme on 1920x920
    console.log("\n📐 Testing Light Theme on 1920x920 Desktop...");
    await page.setViewport({ width: 1920, height: 920 });
    const headerBtns = await page.$$("button");
    for (const b of headerBtns) {
      const title = await (await b.getProperty("title")).jsonValue();
      if (title?.includes("Switch to Light Theme") || title?.includes("Switch to Dark Theme")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "responsive_1080p_desktop_light.png") });
    console.log("   📸 Saved responsive_1080p_desktop_light.png");

    console.log("\n🎉 Responsive testing finished successfully!");
  } catch (err) {
    console.error("❌ Responsive test failed:", err);
  } finally {
    await browser.close();
  }
}

runResponsiveTests();
