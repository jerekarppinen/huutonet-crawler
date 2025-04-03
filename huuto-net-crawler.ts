import puppeteer from 'puppeteer-extra';
import { Browser, Page } from 'puppeteer';
import * as fs from 'fs/promises';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { isAfter, isBefore, parse } from 'date-fns';
import { ItemLink, SoldDeal, ProgressTracker, RuntimeConfig } from './types';

function jsonToCsv(items: SoldDeal[]) {
  const header = Object.keys(items[0]);  const headerString = header.join(',');  // handle null or undefined values here
  const replacer = (key: string, value: unknown) => value ?? '';  const rowItems = items.map((row) =>
    header
      .map((fieldName) => JSON.stringify(((row as unknown) as Record<string, unknown>)[fieldName], replacer))
      .join(',')
  );  // join header and body, and break into separate lines
  const csv = [headerString, ...rowItems].join('\r\n');  return csv;
}

puppeteer.use(StealthPlugin());

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

// Function to add random delay to mimic human behavior
async function randomDelay(min: number, max: number, message: string = 'delay'): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    console.log('---')
    console.log('min', min)
    console.log('max', max)
    console.log(`${message} ${delay}`)
    console.log('---')
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

async function collectLinks(RUNTIME_CONF: RuntimeConfig): Promise<ItemLink[] | undefined> {
  // Store all collected links
  const allLinks: ItemLink[] = [];
  
  // Launch the browser with anti-detection settings
  const browser = await launchBrowser();

  try {
    const page = await setupPage(browser);
    
    // Initial URL - start from page 1
    let currentUrl: string = RUNTIME_CONF.START_PAGE_URL.replace('current', RUNTIME_CONF.START_PAGE_NUMBER.toString())
    let pageNum: number = RUNTIME_CONF.START_PAGE_NUMBER
    
    console.log(`Starting to collect links from Huuto.net`);
    console.log('');
    console.log('MIN_PRICE: ' + RUNTIME_CONF.MIN_PRICE);
    console.log('MAX_PRICE: ' + RUNTIME_CONF.MAX_PRICE);
    console.log('MAX_DATE: ' + RUNTIME_CONF.MAX_DATE);
    console.log('MAX_PAGES_TO_CRAWL: ' + RUNTIME_CONF.MAX_PAGES_TO_CRAWL);
    console.log('');
    console.log(`Navigating to first page: ${currentUrl}`);
    
    // Add random delay before first navigation
    if(RUNTIME_CONF.ENABLE_DELAY_BETWEEN_ACTIONS) {
      await randomDelay(100, 200, 'delay before first navigation');
    }
    
    
    // Navigate to the page
    await page.goto(currentUrl, { waitUntil: 'networkidle2' });

    
    // Add a random delay to seem more human-like
    if(RUNTIME_CONF.ENABLE_DELAY_BETWEEN_ACTIONS) {
      await randomDelay(300, 750, 'delay to humanize action');
    }
    
    // Handle cookie consent if it appears
    await handleCookieConsent(page);
    
    // Scroll down a bit to load any lazy-loaded content
    await autoScroll(page);
    
    // Process all pages up to maxPages
    do {
      console.log(`\nProcessing page ${pageNum}/${RUNTIME_CONF.MAX_PAGES_TO_CRAWL}: ${currentUrl}`);
      
      if (pageNum > 1) {
        // Already loaded page 1
        if(RUNTIME_CONF.ENABLE_DELAY_BETWEEN_ACTIONS) {
          await randomDelay(150, 250, 'delay before goto');
        }
        
        await page.goto(currentUrl, { waitUntil: 'networkidle2' });

        if(RUNTIME_CONF.ENABLE_DELAY_BETWEEN_ACTIONS) {
          await randomDelay(100, 250, 'delay after goto');
        }
        
        
        // Handle cookie consent if it appears again
        await handleCookieConsent(page);
        
        await autoScroll(page);
      }
      
      // Wait for items to be visible
      await page.waitForSelector('.item-card-link', { timeout: 10000 })
        .catch(() => console.log('Warning: Item links selector timeout - page might be empty or structure changed'));

      
      // Get all the links with the specified class
      const links: ItemLink[] = await page.evaluate((RUNTIME_CONF: RuntimeConfig) => {

        const cleanPrice = (price: string): number =>  {
          const euroSymbolStripped = price.replace('€', '')
          const replaceComma = euroSymbolStripped.replace(',', '.')
          return Number(replaceComma)
        }

        // Use document.querySelectorAll instead of $$ to match standard DOM API
        const elements = document.querySelectorAll('.item-card-link');
        
        return Array.from(elements).map(el => {

          const itemPriceString = el.querySelector('.item-card__price')?.textContent ?? '';

          const itemPrice = cleanPrice(itemPriceString)
          
          if(itemPrice >= RUNTIME_CONF.MIN_PRICE && itemPrice <= RUNTIME_CONF.MAX_PRICE) {
            return {
              href: (el as HTMLAnchorElement).href,
              price: itemPrice
            };
          }
        }).filter((item): item is ItemLink => item !== undefined); // Filter out undefined values
      }, RUNTIME_CONF);
      
      console.log(`Found ${links.length} links on page ${pageNum}`);
      
      // Add the current page's links to our collection
      allLinks.push(...links);
      
      // Move to next page
      pageNum++;
      if (pageNum <= RUNTIME_CONF.MAX_PAGES_TO_CRAWL) {

        currentUrl = currentUrl.replace(/\/page\/\d+\//, `/page/${pageNum}/`);

        // Add a slightly longer delay between page navigations
        if(RUNTIME_CONF.ENABLE_DELAY_BETWEEN_ACTIONS) {
          await randomDelay(1000, 2000, 'delay to wait between page naviations: ');
        }
      }
    } while (pageNum <= RUNTIME_CONF.MAX_PAGES_TO_CRAWL);
    
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

async function findSoldDeals(links: ItemLink[], maxDealsToProcess: number = Infinity, RUNTIME_CONF: RuntimeConfig): Promise<SoldDeal[]> {
  console.log(`Starting to filter sold deals (max deals to process: ${maxDealsToProcess})...`);
  
  // Initialize progress tracker with defaults
  let progressTracker: ProgressTracker = {
    lastCheckedIndex: -1,
    soldDeals: []
  };
  
  // Load existing progress if available
  try {
    const existingData = await fs.readFile('huuto_progress_tracker.json', 'utf-8');
    progressTracker = JSON.parse(existingData);
    
    console.log(`Loaded existing progress: Last checked index: ${progressTracker.lastCheckedIndex}, Found sold deals: ${progressTracker.soldDeals.length}`);
    
    // Ask for confirmation
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    await new Promise<void>((resolve) => {
      readline.question(`Continue from link #${progressTracker.lastCheckedIndex + 1}? (yes/no): `, (answer: string) => {
        if (answer.toLowerCase() !== 'yes') {
          progressTracker.lastCheckedIndex = -1;
          console.log('Starting from the beginning.');
        } else {
          console.log(`Continuing from link #${progressTracker.lastCheckedIndex + 1}`);
        }
        readline.close();
        resolve();
      });
    });
    
  } catch (err) {
    console.log('No existing progress file found, starting from the beginning.');
  }
  
  // Start from the next unchecked link
  const startIndex = progressTracker.lastCheckedIndex + 1;
  
  for (let i = startIndex; i < links.length; i++) {
    console.log(`Checking link ${i+1}/${links.length}: ${links[i].href}`);
    
    // Create a new browser instance for each link
    const browser = await launchBrowser();
    
    try {
      // Set up the page with anti-detection measures
      const page = await setupPage(browser);
      
      try {
        // Add random delay before visiting the page
        if(RUNTIME_CONF.ENABLE_DELAY_BETWEEN_ACTIONS) { 
          await randomDelay(750, 1500, 'delay before visiting the page');
        }
        
        
        // Navigate to the page
        await page.goto(links[i].href, { waitUntil: 'networkidle2', timeout: 30000 });
        
        // Handle cookie consent if it appears
        await handleCookieConsent(page);
        
        // Add random delay to simulate reading
        if(RUNTIME_CONF.ENABLE_DELAY_BETWEEN_ACTIONS) {
          await randomDelay(1000, 2000, 'delay to simulate reading');
        }
        
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
            const dateElement = document.querySelector('.closing-info span.text-block');
            const closedDate = dateElement ? (dateElement as HTMLElement).innerText.trim().split(' ')[0] : undefined;

            const sellerElement = document.querySelector('.mini-profile a');
            const seller = sellerElement ? (sellerElement as HTMLElement).innerText : undefined

            const buyerElement = document.querySelector('.control-panel-item p a');
            const buyer = buyerElement ? (buyerElement as HTMLElement).innerText : undefined
            
            return { title, price, closedDate, seller, buyer };
          });

          console.log('dealInfo', dealInfo)

          // const latestClosedDate = dealInfo.closedDate!

          // const DATE_FORMAT = 'dd.MM.yyyy';

          // const maxDate = parse(RUNTIME_CONF.MAX_DATE, DATE_FORMAT, new Date());
          // const dealDate = parse(latestClosedDate, DATE_FORMAT, new Date());

          // console.log('dealDate', dealDate)
          // console.log('maxDate', maxDate)
          // console.log('isBefore(compareDate, maxDate)', isBefore(dealDate, maxDate))

          // if (isBefore(dealDate, maxDate)) {
          //   console.log('Reached or passed max date: ' + RUNTIME_CONF.MAX_DATE + '. Stopping crawler.');
          //   break;
          // } else {
          //   console.log('Continuing to crawl. Latest date (' + latestClosedDate + ') is before max date (' + RUNTIME_CONF.MAX_DATE + ').');
          // }
          
          // Add the deal to our collection
          progressTracker.soldDeals.push({
            ...links[i],
            ...dealInfo
          });
        }
        
        // Update last checked index regardless of whether it was a sold deal
        progressTracker.lastCheckedIndex = i;
        
        // Save progress after each link is checked
        await fs.writeFile('huuto_progress_tracker.json', JSON.stringify(progressTracker, null, 2));
        
        // Also save sold deals separately for convenience
        await fs.writeFile('huuto_sold_deals.json', JSON.stringify(progressTracker.soldDeals, null, 2));
        
      } catch (pageError) {
        console.error(`Error processing link ${links[i].href}:`, pageError);
        
        // If we encounter a Cloudflare challenge, wait longer before continuing
        if (pageError instanceof Error && (pageError.message.includes('timeout') || pageError.message.includes('Navigation failed'))) {
          console.log('Possible anti-bot challenge detected. Adding extra delay...');
          if(RUNTIME_CONF.ENABLE_DELAY_BETWEEN_ACTIONS) {
            await randomDelay(500, 10000, 'delay for anti-bot challenge');
          }
        }
      }
    } catch (error) {
      console.error(`Browser error with link ${links[i].href}:`, error);
    } finally {
      // Always close the browser to free resources
      await browser.close();
      
      // Add a longer random delay between browser instances
      if(RUNTIME_CONF.ENABLE_DELAY_BETWEEN_ACTIONS) {
        await randomDelay(500, 750, 'delay between browser instances');
      }
    }
  }
  
  return progressTracker.soldDeals;
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
async function main() {

  // Start the timer
  const startTime = Date.now();
  console.log(`Script started at: ${new Date(startTime).toLocaleString()}`);
  
  try {

    // Configurable parameters
    const RUNTIME_CONF: RuntimeConfig = {
      START_PAGE_URL: 'https://www.huuto.net/haku/status/closed/page/current/sort/newest/category/110',
      START_PAGE_NUMBER: 1,
      MAX_PAGES_TO_CRAWL: 1,
      ENABLE_DELAY_BETWEEN_ACTIONS: false,
      MIN_PRICE: 10,
      MAX_PRICE: 15,
      MAX_DATE: '28.3.2025'
    }

    const MAX_DEALS_TO_PROCESS: number = Infinity;

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
    
    // Collect links if needed, with page limit
    if (!links || links.length === 0) {
      links = await collectLinks(RUNTIME_CONF);
    }
    
    // Process closed deals with max deals limit
    if (links && links.length > 0) {
      const closedDeals = await findSoldDeals(links, MAX_DEALS_TO_PROCESS, RUNTIME_CONF);
      console.log('')
      console.log(`Successfully identified ${closedDeals.length} sold deals.`);
    } else {
      console.error('No links available to process.');
    }
  } catch (error) {
    console.error('An unexpected error occurred:', error);
  } finally {
    // End the timer and calculate elapsed time
    const endTime = Date.now();
    const elapsedTime = endTime - startTime;

    const soldDeals = await fs.readFile('huuto_sold_deals.json', 'utf-8');
    const items: SoldDeal[] = JSON.parse(soldDeals);
    const csv = jsonToCsv(items)
  
    await fs.writeFile('sold_deals.csv', csv, 'utf-8');
    
    console.log(`\n========= SCRIPT EXECUTION SUMMARY =========`);
    console.log(`Script started at: ${new Date(startTime).toLocaleString()}`);
    console.log(`Script ended at: ${new Date(endTime).toLocaleString()}`);
    console.log(`Total execution time: ${formatElapsedTime(elapsedTime)}`);
    console.log(`============================================`);
  }
};

main().catch(console.error);
