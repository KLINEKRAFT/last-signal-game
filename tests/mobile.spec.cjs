const { test, expect, devices } = require("@playwright/test");

test.describe("iPhone-first experience", () => {
  const { defaultBrowserType, ...phone } = devices["iPhone 13"];
  test.use(phone);
  test("thumb pad, sprint, journal, sound and portrait rendering", async ({
    page,
    browserName,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("/");
    await page.screenshot({ path: "artifacts/iphone-cover.png", scale: "css" });
    await page.locator("#begin").tap();
    await page.screenshot({
      path: "artifacts/iphone-arrival.png",
      scale: "css",
    });
    await expect(page.locator("#action-label")).toHaveText("Search wreckage");
    await page.locator("#interact").tap();
    await expect(page.locator("#inv-food")).toHaveText("3");
    await page.locator("#sprint").tap();
    await expect(page.locator("#sprint")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const box = await page.locator("#joystick").boundingBox();
    if (browserName === "chromium") {
      const session = await page.context().newCDPSession(page);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchStart",
        touchPoints: [
          { x: box.x + box.width / 2 + 28, y: box.y + box.height / 2 + 10 },
        ],
      });
      await page.waitForTimeout(1600);
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } else {
      await page.mouse.move(
        box.x + box.width / 2 + 28,
        box.y + box.height / 2 + 10,
      );
      await page.mouse.down();
      await page.waitForTimeout(1600);
      await page.mouse.up();
    }
    await page.locator("#help").tap();
    await expect(page.locator("#panel-title")).toHaveText(
      "Notes from the quiet.",
    );
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("last-signal-v1")),
    );
    expect(Math.hypot(saved.position.x, saved.position.z)).toBeGreaterThan(0.8);
    await expect(page.locator("#journal-entries")).toContainText(
      "The radio housing",
    );
    await page.locator("#resume").tap();
    await page.locator("#sound").tap();
    await expect(page.locator("#sound")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await page.locator("#sound").tap();
    await expect(page.locator("#sound")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(390);
    const stats = await page
      .locator("#scene")
      .evaluate((element) => ({ ...element.dataset }));
    expect(stats.threeRevision).toBe("187");
    expect(Number(stats.drawCalls)).toBeLessThan(200);
    expect(errors).toEqual([]);
    await page.screenshot({ path: "artifacts/iphone-final.png" });
  });
  test("small iPhone and landscape keep essential actions inside safe bounds", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 568 });
    await page.goto("/");
    const begin = await page.locator("#begin").boundingBox();
    expect(begin.y + begin.height).toBeLessThanOrEqual(568);
    await page.locator("#begin").tap();
    for (const id of ["pause", "interact", "joystick", "eat", "drink"]) {
      const bounds = await page.locator("#" + id).boundingBox();
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(568);
    }
    await page.screenshot({ path: "artifacts/iphone-small.png" });
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator("#interact")).toBeVisible();
    for (const id of ["interact", "joystick", "eat"]) {
      const b = await page.locator("#" + id).boundingBox();
      expect(b.y + b.height).toBeLessThanOrEqual(390);
    }
    await page.screenshot({
      path: "artifacts/iphone-landscape.png",
      scale: "css",
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.addStyleTag({
      content: ":root { --safe-top: 47px; --safe-bottom: 34px; }",
    });
    const pause = await page.locator("#pause").boundingBox();
    const pack = await page.locator(".belt").boundingBox();
    expect(pause.y).toBeGreaterThanOrEqual(47);
    expect(pack.y + pack.height).toBeLessThanOrEqual(844 - 34);
    const meters = await page.locator(".meters").boundingBox();
    const hint = await page.locator("#interaction-hint").boundingBox();
    expect(meters.y + meters.height).toBeLessThan(hint.y);
    await page.screenshot({
      path: "artifacts/iphone-safe-area.png",
      scale: "css",
    });
  });
});
