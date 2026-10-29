// Responsive WebP derivatives. Originals remain available in ../assets.
// Regenerate after replacing photography with `npm run images:optimize`.
const imageModules = import.meta.glob<string>(
  "../assets/optimized/*.webp",
  { eager: true, query: "?url", import: "default" },
);

function imageSet(prefix: string) {
  const small = imageModules[`../assets/optimized/${prefix}-640.webp`];
  const large = imageModules[`../assets/optimized/${prefix}-1280.webp`];
  return { src: large, srcSet: `${small} 640w, ${large} 1280w` };
}

const unit40 = imageSet("dashboard-5");
const unit30 = imageSet("dashboard-1");
const unit50 = imageSet("dashboard-6");
const unit60 = imageSet("dashboard-8");
const unit70 = imageSet("dashboard-12");

export const GNL1Z_ASSETS = {
  unitImages: { unit40, unit30, unit50, unit60, unit70 },
  // Preserve the string API for existing gallery consumers.
  units: {
    unit30: unit30.src, unit40: unit40.src, unit50: unit50.src,
    unit60: unit60.src, unit70: unit70.src,
    extra: [14, 17, 19, 21].map((n) => imageSet(`dashboard-${n}`).src),
  },
};

export const newsHero = imageSet("news");
