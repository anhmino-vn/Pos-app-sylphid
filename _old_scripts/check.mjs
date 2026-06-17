import puppeteer from 'puppeteer';

(async () => {
  console.log('Launching browser...');
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('BROWSER CONSOLE ERROR:', msg.text());
    } else {
      console.log('BROWSER CONSOLE:', msg.text());
    }
  });

  page.on('pageerror', err => {
    console.log('BROWSER PAGE ERROR:', err.toString());
  });

  // Navigate to login page first to set localStorage
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' });
  
  await page.evaluate(() => {
    localStorage.setItem('sb-profile', JSON.stringify({ role: 'admin', uid: 'test', name: 'Test' }));
    // Bypass useAuth loading by setting a fake user if possible, but actually we need the real auth state.
  });

  // Actually, Vite is running. I will just look for `App.tsx` and disable ProtectedRoute temporarily to force rendering CreateOrder inside Layout without auth!
  
  await browser.close();
})();
