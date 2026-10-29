export const MAX_PHOTO_BYTES = 15 * 1024 * 1024;

/** Convert browser-supported photos to WebP; never disguise an unsupported file. */
export async function compressToWebP(file: File, maxDim = 1600, quality = 0.82): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.size > MAX_PHOTO_BYTES) {
    throw new Error("Choose a browser-supported image smaller than 15 MB. / Choisissez une image compatible de moins de 15 Mo.");
  }
  let img: HTMLImageElement;
  try { img = await loadImage(file); }
  catch { throw new Error("This browser cannot open the image. Convert HEIC/RAW files to JPEG or PNG first. / Convertissez les fichiers HEIC/RAW en JPEG ou PNG."); }
  const { width, height } = fit(img.naturalWidth, img.naturalHeight, maxDim);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Image processing is unavailable in this browser. / Traitement d'image indisponible.");
  context.drawImage(img, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
  canvas.width = 0;
  canvas.height = 0;
  if (!blob || blob.type !== "image/webp") throw new Error("WebP conversion is unavailable. Use a current browser. / Conversion WebP indisponible ; utilisez un navigateur récent.");
  return blob;
}

function fit(width: number, height: number, max: number) {
  if (!width || !height) return { width: 1, height: 1 };
  const ratio = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * ratio)), height: Math.max(1, Math.round(height * ratio)) };
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    const timeout = window.setTimeout(() => finish(reject, new Error("Image decoding timed out.")), 20_000);
    function finish(callback: (value: never) => void, error: Error): void;
    function finish(callback: (value: HTMLImageElement) => void): void;
    function finish(callback: (value: never) => void | ((value: HTMLImageElement) => void), error?: Error) {
      window.clearTimeout(timeout);
      URL.revokeObjectURL(url);
      image.onload = null;
      image.onerror = null;
      if (error) (callback as (value: Error) => void)(error);
      else (callback as (value: HTMLImageElement) => void)(image);
    }
    image.onload = () => finish(resolve);
    image.onerror = () => finish(reject, new Error("Image could not be decoded."));
    image.src = url;
  });
}
