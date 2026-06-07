const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000/orders');
  
  // Wait for the debug div to appear
  try {
    await page.waitForSelector('.bg-red-50', { timeout: 10000 });
    const debugText = await page.textContent('.bg-red-50');
    console.log("DEBUG TEXT FOUND:\n" + debugText);
  } catch (e) {
    console.log("Debug div not found or timeout.");
  }
  
  await browser.close();
})();
