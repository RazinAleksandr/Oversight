/** Regenerates public/icons (icon.svg + PNG app icons) from the logo's iris mark. Usage: npx tsx scripts/icons.ts */
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { logoMark } from '../src/art/logo';
writeFileSync('public/icons/icon.svg', logoMark(512) + '\n');
const b = await chromium.launch();
for (const [size, name] of [[512, 'icon-512.png'], [192, 'icon-192.png'], [180, 'apple-touch-icon.png']] as const) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<html><body style="margin:0;background:#070b14">${logoMark(size)}</body></html>`);
  await p.screenshot({ path: `public/icons/${name}`, omitBackground: false });
  await p.close();
}
await b.close();
console.log('ok');
