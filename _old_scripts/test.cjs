const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  
  try {
    await page.goto('http://localhost:3000/settings/trash', { waitUntil: 'networkidle' });
    
    // Wait for a few seconds to let Firebase finish
    await page.waitForTimeout(5000);
    
    const html = await page.content();
    if (html.includes('Loaded customers')) {
       console.log('Toast "Loaded customers" was found in DOM!');
    }
    if (html.includes('Error loading')) {
       console.log('Toast "Error loading" was found in DOM!');
    }
  } catch (e) {
    console.error(e);
  }
  
  await browser.close();
})();
