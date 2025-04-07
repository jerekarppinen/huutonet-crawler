import { Page } from "puppeteer";

// Handle cookie consent popup
export default async function handleCookieConsent(page: Page): Promise<void> {
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