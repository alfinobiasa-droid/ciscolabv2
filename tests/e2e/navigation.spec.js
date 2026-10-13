import {test,expect} from "@playwright/test";

const pages=["dashboard","modul","sandbox","builder","install","trouble","kuis","quest","subnet","cheat","kamus","menu"];

test("all primary pages render without console errors",async({page})=>{
  const errors=[];
  page.on("console",m=>{if(m.type()==="error")errors.push(m.text())});
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/#dashboard");
  for(const route of pages){
    await page.goto(`/#${route}`);
    await expect(page.locator("#view")).toBeVisible();
    await expect(page.locator("#nav button[data-go]").first()).toHaveAttribute("aria-label", /Buka/);
  }
  expect(errors).toEqual([]);
});
