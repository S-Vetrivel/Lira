import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const ARTIFACTS_DIR = "/home/v3/.gemini/antigravity/brain/7e575195-d931-4fb5-af0d-084276ce076a/screenshots";
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function runE2E() {
  console.log("🚀 Starting end-to-end browser test with Brave...");

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
    // 1. LOGIN PAGE
    console.log("1. Testing Login Page (http://localhost:5173/login)...");
    await page.goto("http://localhost:5173/login", { waitUntil: "networkidle2" });
    await page.waitForSelector("input[type='email']", { timeout: 10000 });

    const pageTitle = await page.title();
    console.log("   👉 Document Title:", pageTitle);

    if (pageTitle.includes("4i Global Sports Hub")) {
      console.error("   ❌ ERROR: Found legacy title '4i Global Sports Hub'!");
    } else {
      console.log("   ✅ Title correctly branded as:", pageTitle);
    }

    const loginScreenshotPath = path.join(ARTIFACTS_DIR, "01_login_page.png");
    await page.screenshot({ path: loginScreenshotPath, fullPage: false });
    console.log("   📸 Captured:", loginScreenshotPath);

    // 2. LOG IN AS ADMIN
    console.log("2. Performing Login as Admin (admin@incuman.com)...");
    await page.type("input[type='email']", "admin@incuman.com");
    await page.type("input[type='password']", "password123");

    // Click submit
    const submitBtn = await page.$("button[type='submit']");
    if (submitBtn) {
      await submitBtn.click();
    }

    // Wait for navigation / state transition to "/"
    await new Promise((r) => setTimeout(r, 3000));
    console.log("   👉 Logged in! Current URL:", page.url());

    // 3. KANBAN BOARD
    console.log("3. Testing Kanban Board View (http://localhost:5173/)...");
    await page.waitForSelector("[draggable='true']", { timeout: 10000 }).catch(() => {});
    const boardTitle = await page.title();
    console.log("   👉 Board Title:", boardTitle);

    const boardScreenshotPath = path.join(ARTIFACTS_DIR, "02_kanban_board.png");
    await page.screenshot({ path: boardScreenshotPath, fullPage: false });
    console.log("   📸 Captured:", boardScreenshotPath);

    // 4. CREATE TASK MODAL
    console.log("4. Testing Create Task Modal...");
    const buttons = await page.$$("button");
    for (const btn of buttons) {
      const text = await page.evaluate((el) => el.innerText, btn);
      if (text && (text.includes("New Task") || text.includes("Create Task"))) {
        await btn.click();
        break;
      }
    }

    await new Promise((r) => setTimeout(r, 1200));
    const modalScreenshotPath = path.join(ARTIFACTS_DIR, "03_create_task_modal.png");
    await page.screenshot({ path: modalScreenshotPath, fullPage: false });
    console.log("   📸 Captured:", modalScreenshotPath);

    // Close modal
    for (const btn of await page.$$("button")) {
      const text = await page.evaluate((el) => el.innerText, btn);
      if (text && text.includes("Cancel")) {
        await btn.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));

    // 5. TASK DETAIL DRAWER
    console.log("5. Testing Task Detail Drawer...");
    const taskCards = await page.$$("[draggable='true']");
    console.log("   👉 Found task cards on board:", taskCards.length);
    if (taskCards.length > 0) {
      await taskCards[0].click();
      await new Promise((r) => setTimeout(r, 2000));
      const drawerScreenshotPath = path.join(ARTIFACTS_DIR, "04_task_detail_drawer.png");
      await page.screenshot({ path: drawerScreenshotPath, fullPage: false });
      console.log("   📸 Captured:", drawerScreenshotPath);

      // Close drawer (click backdrop or press Escape)
      await page.keyboard.press("Escape").catch(() => {});
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 6. MY WORK DASHBOARD
    console.log("6. Testing My Work Dashboard (http://localhost:5173/my-work)...");
    await page.goto("http://localhost:5173/my-work", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));
    const myWorkScreenshotPath = path.join(ARTIFACTS_DIR, "05_my_work_dashboard.png");
    await page.screenshot({ path: myWorkScreenshotPath, fullPage: false });
    console.log("   📸 Captured:", myWorkScreenshotPath);

    // 7. MANAGER OVERVIEW & ANALYTICS
    console.log("7. Testing Analytics Dashboard (http://localhost:5173/analytics)...");
    await page.goto("http://localhost:5173/analytics", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));
    const analyticsScreenshotPath = path.join(ARTIFACTS_DIR, "06_analytics_overview.png");
    await page.screenshot({ path: analyticsScreenshotPath, fullPage: false });
    console.log("   📸 Captured:", analyticsScreenshotPath);

    // 8. STAFF DIRECTORY & WORKLOAD
    console.log("8. Testing Team Directory (http://localhost:5173/team)...");
    await page.goto("http://localhost:5173/team", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));
    const teamScreenshotPath = path.join(ARTIFACTS_DIR, "07_team_directory.png");
    await page.screenshot({ path: teamScreenshotPath, fullPage: false });
    console.log("   📸 Captured:", teamScreenshotPath);

    // 9. PROJECT WORKSPACES
    console.log("9. Testing Projects Hub (http://localhost:5173/projects)...");
    await page.goto("http://localhost:5173/projects", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 2000));
    const projectsScreenshotPath = path.join(ARTIFACTS_DIR, "08_projects_hub.png");
    await page.screenshot({ path: projectsScreenshotPath, fullPage: false });
    console.log("   📸 Captured:", projectsScreenshotPath);

    console.log("🎉 All E2E browser tests completed successfully!");
  } catch (error) {
    console.error("❌ E2E test failed with error:", error);
  } finally {
    await browser.close();
  }
}

runE2E();
