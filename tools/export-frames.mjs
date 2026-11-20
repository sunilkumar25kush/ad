/* =========================================================
   ResumeBuddy Commercial — Puppeteer Frame-by-Frame Exporter
   Bang Motion Deterministic Render Pipeline
   ========================================================= */
import puppeteer from 'puppeteer';
import { mkdir } from 'node:fs/promises';

const URL   = process.env.URL || 'http://127.0.0.1:5178/index.html?clean=1';
const FPS   = Number(process.env.FPS || 60);
const OUT   = process.env.OUT || 'frames';
const SCALE = Number(process.env.SCALE || 1);

await mkdir(OUT, { recursive: true });

console.log(`Launching browser to export from ${URL}...`);
const browser = await puppeteer.launch({
  headless: 'new',
  args: ['--enable-gpu', '--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: SCALE });
await page.goto(URL, { waitUntil: 'networkidle0' });

await page.waitForFunction('window.OPENER && window.OPENER.ready', { timeout: 60000 });
await page.evaluate(() => document.fonts.ready);
await page.evaluate(() => { window.OPENER.tl.pause(0); });

const DURATION = await page.evaluate(() => window.OPENER.DURATION);
const total = Math.ceil(DURATION * FPS);
console.log(`Starting export: ${total} frames @ ${FPS} fps (${DURATION}s) -> ${OUT}/`);

for (let i = 0; i < total; i++) {
  const t = i / FPS;

  await page.evaluate(async (time) => {
    window.OPENER.seek(time);
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
    window.OPENER.seek(time);
  }, t);

  await page.screenshot({
    path: `${OUT}/f${String(i).padStart(5, '0')}.png`,
    clip: { x: 0, y: 0, width: 1920, height: 1080 },
    optimizeForSpeed: true,
  });

  if (i % FPS === 0 || i === total - 1) {
    process.stdout.write(`\rProgress: ${i + 1}/${total} frames (${t.toFixed(1)}s / ${DURATION}s)`);
  }
}

console.log(`\nExport complete! ${total} frames saved to ${OUT}/`);
console.log(`\nTo assemble MP4 with FFmpeg:`);
console.log(`ffmpeg -framerate 60 -i ${OUT}/f%05d.png -c:v libx264 -pix_fmt yuv420p -crf 16 resumebuddy-commercial.mp4`);

await browser.close();
