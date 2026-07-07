// Operational manuals — real Sonatrach GNL1Z manual files stored on Google Drive.
export interface Manual {
  id: string;
  title_en: string;
  title_fr: string;
  category: string;
  drive_id: string;
}

export const MANUALS: Manual[] = [
  { id: "S01", title_en: "MEA — Decarbonation", title_fr: "MEA — Décarbonatation", category: "Treatment", drive_id: "103T3eROqirYc2Go3xE0vbcr6i_9cjSDi" },
  { id: "S02", title_en: "Dehydration", title_fr: "Déshydratation", category: "Treatment", drive_id: "19VBliziY8yD7_tM_81SbZIRe28kk7eNg" },
  { id: "S03", title_en: "Propane Refrigeration", title_fr: "Réfrigération Propane", category: "Refrigeration", drive_id: "1g7KrNzjLyQM6Ijp29ISkv_uATUecADIN" },
  { id: "S04", title_en: "Feed Separation", title_fr: "Séparation d'Alimentation", category: "Process", drive_id: "1nBATg7dpHHiFOf3qNXR9ZOU6hUqSedEQ" },
  { id: "S05", title_en: "MCR Refrigeration", title_fr: "Réfrigération MCR", category: "Refrigeration", drive_id: "1sWLzexkdPf7w42D_GaPK7KY1CzhoemM8" },
  { id: "S06", title_en: "Liquefaction", title_fr: "Liquéfaction", category: "Process", drive_id: "1yxKUQGBv1yAO6wR4bftRwJU9L0aibCMh" },
  { id: "S07", title_en: "Demethanizer", title_fr: "Déméthaniseur", category: "Fractionation", drive_id: "1jY5d8TgWrXvAOaQXdS4D3IQmYB9Xe_N_" },
  { id: "S08", title_en: "Deethanizer", title_fr: "Déethaniseur", category: "Fractionation", drive_id: "1mpQ-cEh2cqfegsWBU7oFN7Y8NurZoLRn" },
  { id: "S09", title_en: "Depropanizer", title_fr: "Dépropaniseur", category: "Fractionation", drive_id: "1uOjwdUaVrwG_TSfoa14GmZzrTs-jkYCI" },
  { id: "S10", title_en: "Debutaniser", title_fr: "Débutaniseur", category: "Fractionation", drive_id: "1HdmaZ0YTR9Es9G-TT3Acby_L6R8Dr0MC" },
  { id: "S11.1", title_en: "Closed Cooling Water", title_fr: "Eau de Refroidissement Fermée", category: "Utilities", drive_id: "1ydDQrnlHhfoO1Flkow1suyZ7zv30JGJ4" },
  { id: "S11.2", title_en: "Process Fuel Gas", title_fr: "Fuel Gas Procédé", category: "Utilities", drive_id: "1NC7VkMHm4VQmRR2StT-RFb6fKyR69Oza" },
  { id: "S11.3", title_en: "Liquid Disposal", title_fr: "Évacuation Liquides", category: "Utilities", drive_id: "159o7jnCQUUMzQP3dlJ99g4UZIWmtmhp_" },
  { id: "S11.4", title_en: "Flare", title_fr: "Torche", category: "Safety", drive_id: "1QSqyyM6Ao6SmlGsQ-Jejr1oEm2YP-uBN" },
  { id: "S11.5", title_en: "Derime", title_fr: "Dégivrage", category: "Operations", drive_id: "1XcdJCOjWf8EAw9uvi9F-PifNd2JyvpAq" },
  { id: "S11.6", title_en: "Seawater", title_fr: "Eau de Mer", category: "Utilities", drive_id: "14YXMTLcxObvOM8tQGYJszb4W4bCuFKR2" },
  { id: "S11.7", title_en: "Instrument Air", title_fr: "Air Instrument", category: "Utilities", drive_id: "1FUlD1H0fLoNdPUdvkIZLCQ81dveRXbUN" },
  { id: "S11.8", title_en: "Plant Air", title_fr: "Air Service", category: "Utilities", drive_id: "1LeSEIDY-fRh6EvQqfXwTH83D4XE2Ogp9" },
  { id: "S11.9", title_en: "Nitrogen Distribution", title_fr: "Distribution Azote", category: "Utilities", drive_id: "1NnA1ppAA6iUTeTcNNVwQ3HHLa5TgYCjO" },
  { id: "S12", title_en: "LNG Storage", title_fr: "Stockage GNL", category: "Storage", drive_id: "15zTXm7OEbvCDgEB536qMlahsM2OXt0-N" },
  { id: "S13", title_en: "LNG Loading", title_fr: "Chargement GNL", category: "Operations", drive_id: "1ocQlVMIyiJJFgBummCv0NfQu1kEoLccP" },
  { id: "S14", title_en: "Global Startup", title_fr: "Démarrage Global", category: "Operations", drive_id: "1cJI39N-eXQdaDdZWp5DAvHGxLFNef2oQ" },
  { id: "S15", title_en: "Global Shutdown", title_fr: "Arrêt Global", category: "Operations", drive_id: "1c4V8p73gF4FejooYgBJIVeX57mF71VS0" },
];

export function driveDocViewUrl(driveId: string) {
  return `https://drive.google.com/file/d/${driveId}/view`;
}
