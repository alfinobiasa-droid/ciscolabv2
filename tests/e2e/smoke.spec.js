import {test,expect} from "@playwright/test";

test.describe("NETLAB smoke flows",()=>{
  test("quiz page opens and answers a question",async({page})=>{
    await page.goto("/#kuis");
    await expect(page.locator("#view")).toContainText(/Kuis|Quiz/i);
    const option=page.locator('[data-q="opt"]').first();
    if(await option.count()){
      await option.click();
      await expect(page.locator("#view")).toContainText(/Jawaban|benar|salah/i);
    }
  });
  test("sandbox page exposes CLI",async({page})=>{
    await page.goto("/#sandbox");
    await expect(page.locator("#view")).toContainText(/Sandbox|Cisco|Linux/i);
    await expect(page.locator("#tcmd")).toHaveAttribute("aria-label", "Command");
    await expect(page.locator("#tcmd")).toBeVisible();
  });
});
