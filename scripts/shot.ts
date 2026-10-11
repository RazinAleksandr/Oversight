/**
 * Screenshot helper for visual QA.
 * Usage: npx tsx scripts/shot.ts <url> <out.png> [width=390] [height=844] [--full] [--wait=ms] [--eval="js"] [--click="css selector"]...
 * Clicks/evals run in order before the screenshot. Prints console errors from the page.
 */
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const [url, out] = args;
const nums = args.slice(2).filter((a) => /^\d+$/.test(a)).map(Number);
const width = nums[0] ?? 390;
const height = nums[1] ?? 844;
const full = args.includes('--full');
const waitArg = args.find((a) => a.startsWith('--wait='));
const wait = waitArg ? Number(waitArg.slice(7)) : 800;
const steps = args.filter((a) => a.startsWith('--click=') || a.startsWith('--eval='));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
const errors: string[] = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(url, { waitUntil: 'networkidle' });
await page.waitForTimeout(wait);
for (const s of steps) {
  if (s.startsWith('--click=')) { await page.click(s.slice(8)); }
  else { await page.evaluate(s.slice(7)); }
  await page.waitForTimeout(wait);
}
await page.screenshot({ path: out, fullPage: full });
await browser.close();
console.log(`saved ${out} (${width}x${height})`);
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'));
