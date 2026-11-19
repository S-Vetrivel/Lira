import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const ARTIFACTS_DIR = "/home/v3/.gemini/antigravity/brain/7e575195-d931-4fb5-af0d-084276ce076a/screenshots";
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function runRoleAnalyticsTest() {
  console.log("🚀 Launching Brave Browser for Role Analytics & Spotlight Search E2E Test...");

  const browser = await puppeteer.launch({
    executablePath: "/opt/brave.com/brave/brave",
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--window-size=1440,900",
    ],
    defaultViewport: {
      width: 1440,
      height: 900,
    },
  });

  const page = await browser.newPage();

  try {
    // 1. LOGIN AS EMPLOYEE (Rahul Sharma)
    console.log("1. Navigating to login...");
    await page.goto("http://localhost:5173/login", { waitUntil: "networkidle2" });
    await page.waitForSelector("button", { timeout: 10000 });

    console.log("   👉 Logging in as Employee (Rahul Sharma)...");
    const demoBtns = await page.$$("button");
    for (const btn of demoBtns) {
      const text = await (await btn.getProperty("textContent")).jsonValue();
      if (text.includes("Rahul Sharma") || text.includes("Employee")) {
        await btn.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));

    // 2. NAVIGATE TO ANALYTICS AS EMPLOYEE
    console.log("2. Navigating to Analytics as Employee (Dark Mode)...");
    await page.goto("http://localhost:5173/analytics", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "role_01_employee_dark.png") });

    // 3. TEST SPOTLIGHT COMMAND PALETTE
    console.log("3. Testing Spotlight Command Palette...");
    await page.keyboard.down("Control");
    await page.keyboard.press("KeyK");
    await page.keyboard.up("Control");
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "role_02_spotlight_open.png") });

    // Type query
    await page.keyboard.type("ENG");
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "role_03_spotlight_search_eng.png") });

    // Close Spotlight
    await page.keyboard.press("Escape");
    await new Promise((r) => setTimeout(r, 400));

    // 4. SWITCH TO LIGHT THEME
    console.log("4. Switching to Light Theme...");
    const headerBtns = await page.$$("button");
    for (const b of headerBtns) {
      const title = await (await b.getProperty("title")).jsonValue();
      if (title?.includes("Switch to Light Theme") || title?.includes("Switch to Dark Theme")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 800));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "role_04_employee_light.png") });

    // 5. SWITCH ROLE TO MANAGER (Sarah Connor)
    console.log("5. Switching Role to Manager (Sarah Connor)...");
    // Click user profile chip to open menu
    const profileChips = await page.$$("header button");
    for (const chip of profileChips) {
      const text = await (await chip.getProperty("textContent")).jsonValue();
      if (text.includes("Rahul") || text.includes("Guest") || text.includes("employee") || text.includes("Sharma")) {
        await chip.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 600));

    // Click Lead button (👔 Lead)
    const leadBtns = await page.$$("button");
    for (const b of leadBtns) {
      const text = await (await b.getProperty("textContent")).jsonValue();
      if (text.includes("Lead") || text.includes("👔")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));

    // Navigate to Analytics as Manager
    await page.goto("http://localhost:5173/analytics", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "role_06_manager_analytics.png") });
    console.log("   📸 Captured role_06_manager_analytics.png (Manager View)");

    // 6. SWITCH ROLE TO ADMIN (Alex Vance)
    console.log("6. Switching Role to Administrator (Alex Vance)...");
    // Open profile menu
    const profileChipsAdmin = await page.$$("header button");
    for (const chip of profileChipsAdmin) {
      const text = await (await chip.getProperty("textContent")).jsonValue();
      if (text.includes("Sarah") || text.includes("manager") || text.includes("Lead") || text.includes("Connor")) {
        await chip.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 600));

    // Click 👑 Admin button
    const adminBtns = await page.$$("button");
    for (const b of adminBtns) {
      const text = await (await b.getProperty("textContent")).jsonValue();
      if (text.includes("Admin") || text.includes("👑")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 2000));

    // Switch back to Dark mode
    const toggleToDark = await page.$$("button");
    for (const b of toggleToDark) {
      const title = await (await b.getProperty("title")).jsonValue();
      if (title?.includes("Switch to Dark Theme")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 800));

    // Navigate to Analytics as Admin
    await page.goto("http://localhost:5173/analytics", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "role_07_admin_analytics_dark.png") });
    console.log("   📸 Captured role_07_admin_analytics_dark.png (Admin View)");

    console.log("🎉 All Role Analytics & Spotlight Search tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
  } finally {
    await browser.close();
  }
}

runRoleAnalyticsTest();
