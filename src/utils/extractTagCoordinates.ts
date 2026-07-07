import Tesseract from "tesseract.js";

export interface OCRTag {
  text: string;
  x: number;
  y: number;
}

export async function extractTagCoordinates(
  imageUrl: string
): Promise<OCRTag[]> {
  const result = await Tesseract.recognize(imageUrl, "eng");

  return result.data.words
    .filter(word => {
      const txt = word.text.trim();
      return /^\d{3}-[A-Z]\d+/.test(txt) ||
             /^\d{3}-[FGERK]\d+/.test(txt) ||
             txt.includes("F07") ||
             txt.includes("R03") ||
             txt.includes("K01");
    })
    .map(word => ({
      text: word.text,
      x: word.bbox.x0,
      y: word.bbox.y0
    }));
}
