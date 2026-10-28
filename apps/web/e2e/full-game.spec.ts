import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const SHOTS = join(import.meta.dirname, "screenshots");
mkdirSync(SHOTS, { recursive: true });

const shot = (page: Page, name: string) => page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true });

const TYPED =
  "ตั้งทีมเฉพาะกิจดูแลกลุ่มที่เดือดร้อนที่สุด ใช้งบสำรองที่มีอยู่ ตรวจสอบการใช้เงินอย่างโปร่งใส และรายงานผลต่อสภาทุกสามเดือน";

test("plays a full term with presets and one typed answer, and reaches the ending", async ({ page }) => {
  await page.goto("/");

  // 1. Start screen: dev banner on every screen, difficulty, start.
  await expect(page.locator("[data-screen=start]")).toBeVisible();
  await expect(page.getByTestId("dev-banner")).toContainText("ข้อมูลทดสอบ ไม่ใช่ข้อมูลจริง");
  await expect(page.getByTestId("start-button")).toBeEnabled();
  await shot(page, "01-start");
  await page.getByTestId("start-button").click();

  // 1b. Charter ("ใบรับตำแหน่ง") with the country and its starting stats.
  await expect(page.getByTestId("charter")).toBeVisible();
  await expect(page.getByTestId("charter")).toContainText("DEV FIXTURE");
  await expect(page.getByTestId("dev-banner")).toBeVisible();
  await shot(page, "01b-charter");

  // 1c. Country traits ("ลักษณะประเทศ"): bars, a source on tap, patronage flagged as a proxy, a missing trait explained.
  await expect(page.getByTestId("trait-panel")).toBeVisible();
  await expect(page.getByTestId("trait-panel").getByRole("button")).toHaveCount(7);
  await page.getByTestId("trait-patronage").click();
  await expect(page.getByTestId("source-dialog")).toBeVisible();
  await expect(page.getByTestId("trait-proxy")).toContainText("ค่าประมาณ");
  await expect(page.getByTestId("source-fixture")).toContainText("DEV FIXTURE — invented values");
  await shot(page, "01c-trait-source");
  await page.getByRole("button", { name: "ปิด" }).click();
  await page.getByTestId("trait-resources").click();
  await expect(page.getByTestId("trait-missing")).toContainText("ถือเป็นค่ากลาง");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("source-dialog")).toBeHidden();
  await page.getByTestId("accept-charter").click();

  // 2. Main screen; a stat opens its source.
  await expect(page.locator("[data-screen=main]")).toBeVisible();
  await expect(page.getByTestId("quarter")).toContainText("ไตรมาสที่ 1");
  await expect(page.getByTestId("dev-banner")).toBeVisible();
  await expect(page.getByTestId("stat-grid").getByRole("button")).toHaveCount(15);
  await shot(page, "02-main");
  await page.getByTestId("stat-inflation").click();
  await expect(page.getByTestId("source-dialog")).toBeVisible();
  await expect(page.getByTestId("source-fixture")).toContainText("DEV FIXTURE — invented values");
  await shot(page, "02b-stat-source");
  await page.getByRole("button", { name: "ปิด" }).click();
  await expect(page.getByTestId("source-dialog")).toBeHidden();
  await page.getByTestId("stat-budget").click();
  await expect(page.getByTestId("source-design")).toContainText("ค่าออกแบบ");
  await page.keyboard.press("Escape");

  let decisions = 0;
  let typedUsed = false;
  let resultShot = false;
  let decisionShot = false;
  let newsSeen = false;
  let sceneCards = 0;
  let followupShot = false;

  for (let step = 0; step < 60; step++) {
    const screen = await page.locator("[data-screen]").first().getAttribute("data-screen");
    if (screen === "ending") break;

    if (screen === "main") {
      await page.getByTestId("advance").click();
      await page.locator("[data-screen=decision], [data-screen=ending]").first().waitFor();
    } else if (screen === "decision") {
      decisions++;
      const submit = page.getByTestId("submit-answer");
      await expect(submit).toBeDisabled();
      if (decisions === 2) {
        // Typed answer: submit stays disabled until the text is long enough.
        await page.getByTestId("choice-free").click();
        await page.getByTestId("free-text").fill("สั้นไป");
        await expect(page.getByTestId("free-counter")).toContainText("6 / 800");
        await expect(submit).toBeDisabled();
        await page.getByTestId("free-text").fill(TYPED);
        await expect(submit).toBeEnabled();
        await shot(page, "03b-decision-typed");
        typedUsed = true;
      } else {
        await page.getByTestId(`choice-${["a", "b", "c"][decisions % 3]}`).click();
        await expect(submit).toBeEnabled();
        if (!decisionShot) {
          await shot(page, "03-decision");
          decisionShot = true;
        }
      }
      await submit.click();
      await expect(page.locator("[data-screen=result]")).toBeVisible();
      await expect(page.getByTestId("narration")).toBeVisible();
      // The result leads with "เกิดอะไรขึ้น": at least one scene card; the numbers are folded under "ดูตัวเลขละเอียด".
      await expect(page.getByTestId("scenes")).toContainText("เกิดอะไรขึ้น");
      await expect(page.getByTestId("scene-card").first()).toBeVisible();
      expect(await page.getByTestId("scene-card").count()).toBeLessThanOrEqual(4);
      await expect(page.getByTestId("scene-badge").first()).toContainText("จาก");
      sceneCards += await page.getByTestId("scene-card").count();
      await expect(page.getByTestId("numbers-details")).not.toHaveAttribute("open", "");
      if (!resultShot) {
        await shot(page, "04-result");
        resultShot = true;
      }
      // Open the details when the numbers are needed.
      await page.getByTestId("numbers-toggle").click();
      await expect(page.getByTestId("stat-changes").or(page.getByText("ยังไม่มีตัวชี้วัดเปลี่ยนทันที"))).toBeVisible();
      await expect(page.getByTestId("measure").first()).toBeVisible();
      if (decisions === 1) await shot(page, "04c-result-numbers");
      if (decisions === 2) {
        // The typed answer is judged as an anti-corruption reform; the fixture country has high patronage.
        await expect(page.getByTestId("friction-note").first()).toContainText("ระบบอุปถัมภ์ทำให้ปฏิรูปยากขึ้น");
        await shot(page, "04b-result-friction");
      }
      await page.getByTestId("continue").click();
      if (!followupShot && (await page.locator("[data-screen=main] [data-testid=scene-card][data-kind=followup], [data-screen=main] [data-testid=scene-card][data-kind=court]").count()) > 0) {
        // Follow-up and court scenes sit in the news log with a "ผลต่อเนื่อง" badge.
        await expect(page.locator("[data-screen=main] [data-testid=scene-badge]").first()).toContainText("ผลต่อเนื่อง");
        await shot(page, "02d-main-followup");
        followupShot = true;
      }
      if (decisions === 1) {
        // Back on the main screen: the news ticker lists what happened while time moved on, with +/- chips.
        await expect(page.locator("[data-screen=main]")).toBeVisible();
        await expect(page.getByTestId("news-ticker")).toBeVisible();
        expect(await page.getByTestId("news-item").count()).toBeGreaterThanOrEqual(1);
        expect(await page.getByTestId("news-chip").count()).toBeGreaterThanOrEqual(1);
        await shot(page, "02c-news");
        newsSeen = true;
      }
    } else {
      throw new Error(`unexpected screen: ${screen}`);
    }
  }

  expect(typedUsed, "the typed answer was exercised").toBe(true);
  expect(newsSeen, "the news ticker was checked").toBe(true);
  expect(decisions).toBeGreaterThanOrEqual(2);
  expect(sceneCards, "every result screen showed scene cards").toBeGreaterThanOrEqual(decisions);

  // 5. Ending.
  await expect(page.locator("[data-screen=ending]")).toBeVisible();
  await expect(page.getByTestId("historian-line")).toContainText("ประวัติศาสตร์จะจดจำคุณว่า");
  await expect(page.getByTestId("grades").getByRole("listitem")).toHaveCount(4);
  await expect(page.getByTestId("legacy")).toBeVisible();
  await expect(page.getByTestId("dev-banner")).toBeVisible();
  // "เส้นทางวาระของคุณ": the term's scenes, at most 10.
  await expect(page.getByTestId("term-path")).toContainText("เส้นทางวาระของคุณ");
  const pathCount = await page.getByTestId("term-path").getByTestId("scene-card").count();
  expect(pathCount).toBeGreaterThanOrEqual(1);
  expect(pathCount).toBeLessThanOrEqual(10);
  await shot(page, "05-ending");
  console.log(`scene cards on result screens: ${sceneCards}; follow-up seen on main: ${followupShot}; term path: ${pathCount}`);
});
