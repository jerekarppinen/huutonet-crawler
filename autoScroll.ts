import { Page } from "puppeteer";

// Function to scroll down the page gradually with random behavior
export default async function autoScroll(page: Page): Promise<void> {
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