// huuto-net-crawler.ts
import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs/promises';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

puppeteer.use(StealthPlugin());

interface ItemLink {
  href: string;
  text: string;
}

interface ClosedDeal extends ItemLink {
  title: string;
  closedDate?: string;
  price?: string;
}

// Create a reusable function to launch a browser with anti-detection settings
async function launchBrowser(): Promise<Browser> {
  return puppeteer.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--window-size=1920,1080',
    ]
  });
}

// Create a function to set up a page with anti-detection measures
async function setupPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  
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

// Function to add random delay to mimic human behavior
async function randomDelay(min: number, max: number): Promise<void> {
    min = Math.floor(min / 2);
    max = Math.floor(max / 2);
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise(resolve => setTimeout(resolve, delay));
}

// Function to scroll down the page gradually with random behavior
async function autoScroll(page: Page): Promise<void> {
  // This version adds randomness to scrolling behavior
  await page.evaluate(() => {
    return new Promise<void>((resolve) => {
      let totalHeight = 0;
      const scrollHeight = document.body.scrollHeight;
      
      const timer = setInterval(() => {
        // Random scroll distance between 80 and 300 pixels
        const distance = Math.floor(Math.random() * 220) + 80;
        
        window.scrollBy(0, distance);
        totalHeight += distance;
        
        // Randomly pause scrolling sometimes to mimic human reading
        if (Math.random() < 0.2) {
          // Pause for 500-2000ms
          const pauseTime = Math.floor(Math.random() * 1500) + 500;
          clearInterval(timer);
          
          setTimeout(() => {
            // Resume scrolling after pause
            if (totalHeight >= scrollHeight) {
              resolve();
            } else {
              // Continue scrolling
              const newTimer = setInterval(() => {
                const newDistance = Math.floor(Math.random() * 220) + 80;
                window.scrollBy(0, newDistance);
                totalHeight += newDistance;
                
                if (totalHeight >= scrollHeight) {
                  clearInterval(newTimer);
                  resolve();
                }
              }, 100 + Math.floor(Math.random() * 50)); // Random interval
            }
          }, pauseTime);
          
        } else if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100 + Math.floor(Math.random() * 50)); // Random interval
    });
  });
}

// Handle cookie consent popup
async function handleCookieConsent(page: Page): Promise<void> {
  await page.evaluate(() => {
    function xcc_contains(selector: string, text: string) {
      var elements = document.querySelectorAll(selector);
      return Array.prototype.filter.call(elements, function(element){
        return RegExp(text, "i").test(element.textContent?.trim() || '');
      });
    }
    var _xcc;
    _xcc = xcc_contains('[id*=cookie] a, [class*=cookie] a, [id*=cookie] button, [class*=cookie] button', '^(Hyväksy kaikki)$');
    if (_xcc != null && _xcc.length != 0) { _xcc[0].click(); }
  });
}

async function collectLinks(): Promise<ItemLink[] | undefined> {
  // Store all collected links
  const allLinks: ItemLink[] = [];
  
  // Launch the browser with anti-detection settings
  const browser = await launchBrowser();

  try {
    const page = await setupPage(browser);
    
    // Initial URL - start from page 1
    let currentUrl: string = 'https://www.huuto.net/haku/status/closed/page/1/sort/newest/category/11';
    let pageNum: number = 1;
    let maxPages: number = 0;
    
    console.log('Starting to collect links from Huuto.net...');
    console.log(`Navigating to first page: ${currentUrl}`);
    
    // Add random delay before first navigation
    await randomDelay(2000, 4000);
    
    // Navigate to the page
    await page.goto(currentUrl, { waitUntil: 'networkidle2' });
    
    // Add a random delay to seem more human-like
    await randomDelay(1500, 3000);

    // Handle cookie consent if it appears
    await handleCookieConsent(page);
    
    // Scroll down a bit to load any lazy-loaded content
    await autoScroll(page);
    
    // Get detailed pagination information on first run
    const paginationInfo = await page.evaluate(() => {
      const paginationElement = document.querySelector('#pagination');
      if (!paginationElement) {
        return { maxPages: 0, paginationFound: false, html: 'No pagination found' };
      }
      
      // Get the HTML of the pagination for debugging
      const paginationHtml = paginationElement.outerHTML;
      
      // Get all page number links
      const pageLinks = document.querySelectorAll('#pagination li.next_pages a, #pagination li.current');
      
      // Extract the page numbers
      const pageNumbers = Array.from(pageLinks).map(el => {
        const num = parseInt(el.textContent?.trim() || '0');
        return isNaN(num) ? 0 : num;
      });
      
      // Find the maximum page number
      const maxPages = pageNumbers.length > 0 ? Math.max(...pageNumbers) : 0;
      
      return { 
        maxPages, 
        paginationFound: true, 
        pageNumbers,
        linkCount: pageLinks.length,
        html: paginationHtml 
      };
    });
    
    console.log('=== PAGINATION DETECTION RESULTS ===');
    console.log(`Pagination found: ${paginationInfo.paginationFound}`);
    console.log(`Maximum page number: ${paginationInfo.maxPages}`);
    console.log('===================================');
    
    // Set the maximum number of pages
    maxPages = paginationInfo.maxPages;
    
    if (maxPages === 0) {
      console.warn('WARNING: No pagination detected or only one page exists.');
      maxPages = 1; // Process at least the current page
    }
    
    console.log(`Will process ${maxPages} pages in total.`);
    
    // Process all pages
    do {
      console.log(`\nProcessing page ${pageNum}/${maxPages}: ${currentUrl}`);
      
      if (pageNum > 1) {
        // Already loaded page 1
        await randomDelay(3000, 5000);
        await page.goto(currentUrl, { waitUntil: 'networkidle2' });
        await randomDelay(1500, 3000);
        
        // Handle cookie consent if it appears again
        await handleCookieConsent(page);
        
        await autoScroll(page);
      }
      
      // Wait for items to be visible
      await page.waitForSelector('.item-card-link', { timeout: 10000 })
        .catch(() => console.log('Warning: Item links selector timeout - page might be empty or structure changed'));
      
      // Get all the links with the specified class
      const links: ItemLink[] = await page.evaluate(() => {
        // Use document.querySelectorAll instead of $$ to match standard DOM API
        const elements = document.querySelectorAll('.item-card-link');
        
        return Array.from(elements).map(el => {
          return {
            href: (el as HTMLAnchorElement).href,
            text: el.textContent?.trim() || ''
          };
        });
      });
      
      console.log(`Found ${links.length} links on page ${pageNum}`);
      
      // Add the current page's links to our collection
      allLinks.push(...links);
      
      // Move to next page
      pageNum++;
      if (pageNum <= maxPages) {
        currentUrl = `https://www.huuto.net/haku/status/closed/page/${pageNum}/sort/newest/category/11`;
        // Add a slightly longer delay between page navigations
        await randomDelay(4000, 7000);
      }
    } while (pageNum <= maxPages);
    
    console.log(`\nCollection complete! Total links collected: ${allLinks.length}`);
    
    // Save the links to a JSON file
    await fs.writeFile('huuto_all_links.json', JSON.stringify(allLinks, null, 2));
    console.log('All links saved to huuto_all_links.json');
    
    return allLinks;
    
  } catch (error) {
    console.error('An error occurred during link collection:', error);
    return undefined;
  } finally {
    await browser.close();
  }
}

async function findClosedDeals(links: ItemLink[]): Promise<ClosedDeal[]> {
  console.log('Starting to filter sold deals...');
  const closedDeals: ClosedDeal[] = [];
  
  // Load existing progress if available
  let startIndex = 0;
  try {
    const existingData = await fs.readFile('huuto_sold_deals_progress.json', 'utf-8');
    const existingDeals: ClosedDeal[] = JSON.parse(existingData);
    
    if (existingDeals && existingDeals.length > 0) {
      closedDeals.push(...existingDeals);
      
      // Find the last processed URL
      const lastProcessedUrl = existingDeals[existingDeals.length - 1].href;
      const lastIndex = links.findIndex(link => link.href === lastProcessedUrl);
      
      if (lastIndex !== -1) {
        startIndex = lastIndex + 1;
        console.log(`Resuming from index ${startIndex} (after ${lastProcessedUrl})`);
      }
    }
  } catch (err) {
    console.log('No existing progress file found, starting from beginning.');
  }
  
  for (let i = startIndex; i < links.length; i++) {
    console.log(`Checking link ${i+1}/${links.length}: ${links[i].href}`);
    
    // Create a new browser instance for each link
    const browser = await launchBrowser();
    
    try {
      // Set up the page with anti-detection measures
      const page = await setupPage(browser);
      
      try {
        // Add random delay before visiting the page
        await randomDelay(1500, 3000);
        
        // Navigate to the page
        await page.goto(links[i].href, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Handle cookie consent if it appears
        await handleCookieConsent(page);
        
        // Add random delay to simulate reading
        await randomDelay(2000, 4000);
        
        // Scroll down a bit to look more human-like
        await autoScroll(page);
        
        // Check if the page contains the closed deal text
        const isClosed = await page.evaluate(() => {
          const closedText = document.querySelector('p[title^="Tuote on myyty käyttäjälle"]');
          return !!closedText;
        });
        
        if (isClosed) {
          console.log('Found a sold deal!');
          
          // Extract additional information
          const dealInfo = await page.evaluate(() => {
            const title = document.querySelector('h1')?.innerText.trim() || 'Unknown Title';
            
            // Try to find price information
            const priceElement = document.querySelector('.price');
            const price = priceElement ? (priceElement as HTMLElement).innerText.trim() : undefined;
            
            // Try to find closed date
            const dateElement = document.querySelector('.closing-info');
            const closedDate = dateElement ? (dateElement as HTMLElement).innerText.trim() : undefined;
            
            return { title, price, closedDate };
          });
          
          closedDeals.push({
            ...links[i],
            ...dealInfo
          });
          
          // Save progress after each closed deal is found
          await fs.writeFile('huuto_sold_deals_progress.json', JSON.stringify(closedDeals, null, 2));
        }
      } catch (pageError) {
        console.error(`Error processing link ${links[i].href}:`, pageError);
        
        // If we encounter a Cloudflare challenge, wait longer before continuing
        if (pageError instanceof Error && (pageError.message.includes('timeout') || pageError.message.includes('Navigation failed'))) {
          console.log('Possible anti-bot challenge detected. Adding extra delay...');
          await randomDelay(10000, 20000);
        }
      }
    } catch (error) {
      console.error(`Browser error with link ${links[i].href}:`, error);
    } finally {
      // Always close the browser to free resources
      await browser.close();
      
      // Add a longer random delay between browser instances
      await randomDelay(5000, 10000);
    }
  }
  
  console.log(`Found ${closedDeals.length} closed deals out of ${links.length} total links`);
  
  // Save the closed deals to a JSON file
  await fs.writeFile('huuto_closed_deals.json', JSON.stringify(closedDeals, null, 2));
  console.log('Closed deals saved to huuto_closed_deals.json');
  
  return closedDeals;
}

// Helper function to format elapsed time
function formatElapsedTime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  const remainingMinutes = minutes % 60;
  const remainingSeconds = seconds % 60;
  
  let result = '';
  
  if (hours > 0) {
    result += `${hours} hour${hours !== 1 ? 's' : ''} `;
  }
  
  if (remainingMinutes > 0 || hours > 0) {
    result += `${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''} `;
  }
  
  result += `${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''}`;
  
  return result;
}

// Main execution
(async () => {
  // Start the timer
  const startTime = Date.now();
  console.log(`Script started at: ${new Date(startTime).toLocaleString()}`);
  
  try {
    // Check if we have existing links
    let links: ItemLink[] | undefined;
    
    try {
      const existingLinks = await fs.readFile('huuto_all_links.json', 'utf-8');
      links = JSON.parse(existingLinks);
      console.log(`Loaded ${links?.length || 0} existing links from huuto_all_links.json`);
      
      // Confirm with user
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });
      
      await new Promise<void>((resolve) => {
        readline.question('Use existing links? (yes/no): ', (answer: string) => {
          if (answer.toLowerCase() !== 'yes') {
            links = undefined;
            console.log('Will collect links again.');
          } else {
            console.log('Using existing links.');
          }
          readline.close();
          resolve();
        });
      });
    } catch (err) {
      console.log('No existing links file found, will collect links.');
    }
    
    // Collect links if needed
    if (!links || links.length === 0) {
      links = await collectLinks();
    }
    
    // Process closed deals
    if (links && links.length > 0) {
      const closedDeals = await findClosedDeals(links);
      console.log(`Successfully identified ${closedDeals.length} closed deals.`);
    } else {
      console.error('No links available to process.');
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error);
  } finally {
    // End the timer and calculate elapsed time
    const endTime = Date.now();
    const elapsedTime = endTime - startTime;
    
    console.log(`\n========= SCRIPT EXECUTION SUMMARY =========`);
    console.log(`Script started at: ${new Date(startTime).toLocaleString()}`);
    console.log(`Script ended at: ${new Date(endTime).toLocaleString()}`);
    console.log(`Total execution time: ${formatElapsedTime(elapsedTime)}`);
    console.log(`============================================`);
  }
})();