import { test, expect } from "@playwright/test";

test("app loads and shows home page", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // Verify the app rendered without crashing
  const body = page.locator("body");
  await expect(body).toBeVisible();
});

test("sidebar is visible", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // Sidebar should be present
  const sidebar = page.getByRole("navigation").first();
  await expect(sidebar).toBeVisible({ timeout: 10000 });
});
