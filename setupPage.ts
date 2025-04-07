import { Browser, Page } from "puppeteer";

// Create a function to set up a page with anti-detection measures
export default async function setupPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();

  // Helper to enable logging for nodejs
  await page.exposeFunction('logInNodeJs', (value: unknown) => console.log(value));
  // Usage:
  // @ts-ignore
  // logInNodeJs(1234)

  // Set a realistic viewport
  await page.setViewport({ width: 1920, height: 1080 });
  
  // Set a realistic user agent
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
  
  // Add additional headers to appear more browser-like
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9,fi;q=0.8',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
    'Accept-Encoding': 'gzip, deflate, br',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  });
  
  // Randomize the timing of the navigation
  await page.setDefaultNavigationTimeout(45000);
  
  return page;
}