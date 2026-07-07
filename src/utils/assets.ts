// ─── DASHBOARD FOLDER ASSETS ───
import dash1 from "@/assets/dashboard/pictures-assets (1).jpg";
import dash5 from "@/assets/dashboard/pictures-assets (5).jpg";
import dash6 from "@/assets/dashboard/pictures-assets (6).jpg";
import dash8 from "@/assets/dashboard/pictures-assets (8).jpg";
import dash12 from "@/assets/dashboard/pictures-assets (12).png";
import dash14 from "@/assets/dashboard/pictures-assets (14).png";
import dash17 from "@/assets/dashboard/pictures-assets (17).png";
import dash19 from "@/assets/dashboard/pictures-assets (19).webp";
import dash21 from "@/assets/dashboard/pictures-assets (21).png";

// ─── ABOUT FOLDER ASSETS ───
import about2 from "@/assets/about/pictures-assets (2).jpg";
import about3 from "@/assets/about/pictures-assets (3).jpg";
import about4 from "@/assets/about/pictures-assets (4).jpg";
import about5 from "@/assets/about/pictures-assets (5).jpg";
import about8 from "@/assets/about/pictures-assets (8).jpg";
import about9 from "@/assets/about/pictures-assets (9).png";
import about18 from "@/assets/about/pictures-assets (18).png";
import about23 from "@/assets/about/pictures-assets (23).jpg";

export const GNL1Z_ASSETS = {
  // Mapping the active unit views directly to your dashboard folder images
  units: {
    unit30: dash1,  // MCR Compressors
    unit40: dash5,  // MCHE
    unit50: dash6,  // Storage Tanks
    unit60: dash8,  // Marine Berth Infrastructure
    unit70: dash12, // Steam/Boilers
    extra: [dash14, dash17, dash19, dash21]
  },
  
  // Array lists for your dynamic layouts
  about: [about2, about3, about4, about5, about8, about9, about18, about23],
  // Remapped news assets to existing high-fidelity dashboard/about images to guarantee perfect Vite build
  news: [dash14, dash17, dash19, dash21, about2, about3, about4, about5, about8]
};
