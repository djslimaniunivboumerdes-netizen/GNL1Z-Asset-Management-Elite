import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Keep the original photography intact. These lightweight, responsive derivatives
// are used by the application and can be regenerated with npm run images:optimize.
const sources = [
  ...[1, 5, 6, 8, 12, 14, 17, 19, 21].map((n) => ({ folder: "dashboard", name: `pictures-assets (${n})` })),
  { folder: "", name: "news-hero" },
];
const output = path.resolve("src/assets/optimized");
await mkdir(output, { recursive: true });
let originalBytes = 0;
let optimizedBytes = 0;
for (const { folder, name } of sources) {
  let source;
  for (const ext of ["jpg", "png", "webp"]) {
    const candidate = path.join("src/assets", folder, `${name}.${ext}`);
    try { await sharp(candidate).metadata(); source = candidate; break; } catch { /* try next extension */ }
  }
  if (!source) continue;
  const prefix = folder ? `${folder}-${name.match(/\d+/)[0]}` : "news";
  const image = sharp(source).rotate();
  const { width = 1600 } = await image.metadata();
  for (const size of [640, 1280]) {
    const file = path.join(output, `${prefix}-${size}.webp`);
    const info = await image.clone().resize({ width: Math.min(size, width), withoutEnlargement: true })
      .webp({ quality: 78, effort: 5 }).toFile(file);
    optimizedBytes += info.size;
  }
  originalBytes += (await sharp(source).metadata()).size ?? 0;
}
console.log(`Responsive images written to ${output}: ${(optimizedBytes / 1024 / 1024).toFixed(2)} MiB total.`);
