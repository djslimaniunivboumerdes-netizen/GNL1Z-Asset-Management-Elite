export interface OCRTagPosition {
  id: string;
  x: number;
  y: number;
}

export const OCR_POSITIONS: Record<string, OCRTagPosition> = {
  "F502": { id: "F502", x: 6.1, y: 46.5 },
  "F501": { id: "F501", x: 10.8, y: 63.7 },
  "G507": { id: "G507", x: 5.3, y: 80.5 },

  "R0311": { id: "R0311", x: 18.2, y: 14.0 },
  "R0310": { id: "R0310", x: 24.4, y: 18.1 },
  "R0312": { id: "R0312", x: 29.0, y: 33.4 },

  "E0540": { id: "E0540", x: 42.3, y: 25.1 },

  // ...
};
