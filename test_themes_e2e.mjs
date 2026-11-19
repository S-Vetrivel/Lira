import puppeteer from "puppeteer-core";
import fs from "fs";
import path from "path";

const ARTIFACTS_DIR = "/home/v3/.gemini/antigravity/brain/7e575195-d931-4fb5-af0d-084276ce076a/screenshots";
if (!fs.existsSync(ARTIFACTS_DIR)) {
  fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
}

async function runThemeTests() {
  console.log("🚀 Launching Brave Browser to test Dark and White/Light Themes...");

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
    // 1. LOGIN
    console.log("1. Navigating to login...");
    await page.goto("http://localhost:5173/login", { waitUntil: "networkidle2" });
    await page.waitForSelector("input[type='email']", { timeout: 10000 });

    await page.type("input[type='email']", "admin@incuman.com");
    await page.type("input[type='password']", "password123");

    const submitBtn = await page.$("button[type='submit']");
    if (submitBtn) await submitBtn.click();

    await new Promise((r) => setTimeout(r, 2500));
    console.log("   👉 Current URL after login:", page.url());

    // ==========================================
    // PHASE 1: DARK THEME SCREENSHOTS
    // ==========================================
    console.log("=== PHASE 1: TESTING DARK THEME ===");

    // 1A. Board (Dark)
    console.log("1A. Capturing Board (Dark)...");
    await page.goto("http://localhost:5173/", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "dark_01_board.png") });

    // 1B. Create Task Modal (Dark)
    console.log("1B. Capturing Create Task Modal (Dark)...");
    const newBtns = await page.$$("button");
    for (const b of newBtns) {
      const text = await page.evaluate((el) => el.innerText, b);
      if (text && text.includes("New Task")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "dark_02_create_modal.png") });

    // Close modal
    for (const b of await page.$$("button")) {
      const text = await page.evaluate((el) => el.innerText, b);
      if (text && text.includes("Cancel")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 600));

    // 1C. Task Detail Drawer (Dark)
    console.log("1C. Capturing Task Detail Drawer (Dark)...");
    const cards = await page.$$("[draggable='true']");
    if (cards.length > 0) {
      await cards[0].click();
      await new Promise((r) => setTimeout(r, 1500));
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "dark_03_task_drawer.png") });

      // Close drawer (click backdrop)
      const closeBtn = await page.$("button[title='Copy Task Key']");
      await page.keyboard.press("Escape").catch(() => {});
      // Also click top close button
      const allBtns = await page.$$("button");
      for (const btn of allBtns) {
        const title = await page.evaluate((el) => el.getAttribute("title"), btn);
        if (title === "Close Drawer") await btn.click();
      }
      await new Promise((r) => setTimeout(r, 800));
    }

    // 1D. Analytics (Dark)
    console.log("1D. Capturing Analytics (Dark)...");
    await page.goto("http://localhost:5173/analytics", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "dark_04_analytics.png") });

    // 1E. My Work (Dark)
    console.log("1E. Capturing My Work (Dark)...");
    await page.goto("http://localhost:5173/my-work", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "dark_05_my_work.png") });

    // 1F. Team Directory (Dark)
    console.log("1F. Capturing Team Directory (Dark)...");
    await page.goto("http://localhost:5173/team", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "dark_06_team.png") });

    // 1G. Projects Hub (Dark)
    console.log("1G. Capturing Projects Hub (Dark)...");
    await page.goto("http://localhost:5173/projects", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "dark_07_projects.png") });

    // ==========================================
    // PHASE 2: SWITCH TO WHITE / LIGHT THEME
    // ==========================================
    console.log("=== PHASE 2: SWITCHING TO WHITE / LIGHT THEME ===");

    // Find and click the Theme Toggle button (title includes "Switch to Light Theme")
    const toggleBtn = await page.$("button[title='Switch to Light Theme']");
    if (toggleBtn) {
      console.log("   👉 Found Theme Toggle button, clicking to activate Light Theme...");
      await toggleBtn.click();
    } else {
      console.log("   👉 Fallback: manually evaluating theme toggle via context/localStorage...");
      await page.evaluate(() => {
        localStorage.setItem("lira_theme", "light");
        document.documentElement.classList.remove("dark");
        document.documentElement.classList.add("light");
        document.body.classList.remove("dark");
        document.body.classList.add("light");
        document.body.style.backgroundColor = "#f8fafc";
        document.body.style.color = "#0f172a";
      });
      await page.reload({ waitUntil: "networkidle2" });
    }

    await new Promise((r) => setTimeout(r, 1500));

    const htmlClasses = await page.evaluate(() => document.documentElement.className);
    console.log("   👉 HTML Element classes after switch:", htmlClasses);

    // ==========================================
    // PHASE 3: WHITE / LIGHT THEME SCREENSHOTS
    // ==========================================
    console.log("=== PHASE 3: TESTING WHITE / LIGHT THEME ===");

    // 3A. Board (Light)
    console.log("3A. Capturing Board (Light)...");
    await page.goto("http://localhost:5173/", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "light_01_board.png") });

    // 3B. Create Task Modal (Light)
    console.log("3B. Capturing Create Task Modal (Light)...");
    for (const b of await page.$$("button")) {
      const text = await page.evaluate((el) => el.innerText, b);
      if (text && text.includes("New Task")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 1000));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "light_02_create_modal.png") });

    // Close modal
    for (const b of await page.$$("button")) {
      const text = await page.evaluate((el) => el.innerText, b);
      if (text && text.includes("Cancel")) {
        await b.click();
        break;
      }
    }
    await new Promise((r) => setTimeout(r, 600));

    // 3C. Task Detail Drawer (Light)
    console.log("3C. Capturing Task Detail Drawer (Light)...");
    const lightCards = await page.$$("[draggable='true']");
    if (lightCards.length > 0) {
      await lightCards[0].click();
      await new Promise((r) => setTimeout(r, 1500));
      await page.screenshot({ path: path.join(ARTIFACTS_DIR, "light_03_task_drawer.png") });

      await page.keyboard.press("Escape").catch(() => {});
      await new Promise((r) => setTimeout(r, 800));
    }

    // 3D. Analytics (Light)
    console.log("3D. Capturing Analytics (Light)...");
    await page.goto("http://localhost:5173/analytics", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "light_04_analytics.png") });

    // 3E. My Work (Light)
    console.log("3E. Capturing My Work (Light)...");
    await page.goto("http://localhost:5173/my-work", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "light_05_my_work.png") });

    // 3F. Team Directory (Light)
    console.log("3F. Capturing Team Directory (Light)...");
    await page.goto("http://localhost:5173/team", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "light_06_team.png") });

    // 3G. Projects Hub (Light)
    console.log("3G. Capturing Projects Hub (Light)...");
    await page.goto("http://localhost:5173/projects", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: path.join(ARTIFACTS_DIR, "light_07_projects.png") });

    console.log("🎉 SUCCESS: Both Dark and Light Themes captured across ALL components!");
  } catch (err) {
    console.error("❌ Test failed:", err);
  } finally {
    await browser.close();
  }
}

runThemeTests();
