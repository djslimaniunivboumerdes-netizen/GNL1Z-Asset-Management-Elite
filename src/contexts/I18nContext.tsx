import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Lang = "en" | "fr";

type Dict = Record<string, { en: string; fr: string }>;

const DICT: Dict = {
  appName: { en: "GNL1Z Assets", fr: "Actifs GNL1Z" },
  appSub: { en: "Sonatrach · Arzew", fr: "Sonatrach · Arzew" },
  dashboard: { en: "Dashboard", fr: "Tableau de bord" },
  about: { en: "About GNL1Z", fr: "À propos GNL1Z" },
  equipment: { en: "Equipment Master", fr: "Maître Équipements" },
  dcs: { en: "DCS Directory", fr: "Répertoire DCS" },
  manuals: { en: "Operational Manuals", fr: "Manuels Opérationnels" },
  news: { en: "News & Markets", fr: "Actualités & Marchés" },
  author: { en: "Author Profile", fr: "Profil Auteur" },
  search: { en: "Search...", fr: "Rechercher..." },
  searchEquipment: { en: "Search by tag, name, serial, unit...", fr: "Rechercher par tag, nom, série, unité..." },
  exportCsv: { en: "Export CSV", fr: "Exporter CSV" },
  copyToolList: { en: "Copy Tool List", fr: "Copier outils" },
  tag: { en: "Tag", fr: "Tag" },
  name: { en: "Name", fr: "Nom" },
  type: { en: "Type", fr: "Type" },
  unit: { en: "Unit", fr: "Unité" },
  section: { en: "Section", fr: "Section" },
  status: { en: "Status", fr: "Statut" },
  parts: { en: "Parts", fr: "Pièces" },
  weight: { en: "Mass (kg)", fr: "Masse (kg)" },
  pressure: { en: "Pressure (bar)", fr: "Pression (bar)" },
  volume: { en: "Volume (m³)", fr: "Volume (m³)" },
  serial: { en: "Serial No.", fr: "N° Série" },
  bolt: { en: "Bolt Size", fr: "Boulon" },
  testPressure: { en: "Test Pressure", fr: "Pression d'épreuve" },
  designPressure: { en: "Design Pressure", fr: "Pression de calcul" },
  shellSide: { en: "Shell side / Calandre", fr: "Calandre / Shell" },
  tubeSide: { en: "Tube side / Faisceau", fr: "Faisceau / Tubes" },
  faciauxSide: { en: "Heads (Faciaux)", fr: "Faciaux" },
  openPid: { en: "Open P&ID", fr: "Ouvrir P&ID" },
  noPid: { en: "No P&ID linked", fr: "Aucun P&ID lié" },
  lastTested: { en: "Last test date", fr: "Dernier essai" },
  nextDue: { en: "Next test due", fr: "Prochain essai" },
  saveDates: { en: "Save dates", fr: "Enregistrer dates" },
  saved: { en: "Saved!", fr: "Enregistré !" },
  testType: { en: "Test type", fr: "Type d'essai" },
  pickDate: { en: "Pick a date", fr: "Choisir une date" },
  panelDetail: { en: "Panel detail", fr: "Détail panneau" },
  related: { en: "Related equipment", fr: "Équipements liés" },
  openInDrive: { en: "Open in Drive", fr: "Ouvrir dans Drive" },
  techInfo: { en: "Tech Info", fr: "Info Tech" },
  pdr: { en: "PDR (Components)", fr: "PDR (Composants)" },
  toolPredictor: { en: "Tool Predictor", fr: "Prédicteur d'Outils" },
  lifting: { en: "Lifting & Rigging", fr: "Levage & Élingage" },
  insulation: { en: "Insulation", fr: "Calorifugeage" },
  back: { en: "Back", fr: "Retour" },
  noResults: { en: "No results", fr: "Aucun résultat" },
  filterAll: { en: "All units", fr: "Toutes unités" },
  filterStatus: { en: "All statuses", fr: "Tous statuts" },
  trains: { en: "Trains", fr: "Trains" },
  equipCount: { en: "Equipment", fr: "Équipements" },
  spareParts: { en: "Spare parts", fr: "Pièces de rechange" },
  process: { en: "Process", fr: "Procédé" },
  lastUpdate: { en: "Last updated", fr: "Dernière MAJ" },
  open: { en: "Open", fr: "Ouvrir" },
  qty: { en: "Qty", fr: "Qté" },
  code: { en: "Code", fr: "Code" },
  description: { en: "Description", fr: "Description" },
  category: { en: "Category", fr: "Catégorie" },
  location: { en: "Stock loc.", fr: "Empl." },
  recommendedTools: { en: "Recommended tools", fr: "Outils recommandés" },
  noBoltData: { en: "No bolt size on record. Tool prediction unavailable.", fr: "Aucune taille de boulon. Prédiction indisponible." },
  safetyLoad: { en: "Safety Load (1.5×)", fr: "Charge sécurité (1.5×)" },
  shackle: { en: "Suggested shackle", fr: "Manille suggérée" },
  liftingMethod: { en: "Lifting method", fr: "Méthode de levage" },
  insulationReq: { en: "Calorifugage requirement", fr: "Exigence calorifugeage" },
  modules: { en: "Modules", fr: "Modules" },
  exec_summary: { en: "Executive Summary", fr: "Résumé Exécutif" },
  copy: { en: "Copy", fr: "Copier" },
  copied: { en: "Copied!", fr: "Copié !" },

  /* ─── EXPANDED TRANSLATION KEYS ─── */
  flow: { en: "Process Flow", fr: "Schéma Procédé" },
  smartFlow: { en: "Smart Flow", fr: "Schéma Intelligent" },
  testSchedule: { en: "Test Schedule", fr: "Calendrier d'Essais" },
  fastAlerts: { en: "Fast Alerts", fr: "Alertes Rapides" },
  signIn: { en: "Sign In", fr: "Connexion" },
  signOut: { en: "Sign Out", fr: "Déconnexion" },
  operatorProfile: { en: "Operator Profile", fr: "Profil Opérateur" },
  appDownloads: { en: "App Downloads", fr: "Téléchargements" },
  systemModules: { en: "System Modules", fr: "Modules du Système" },
  exploreModule: { en: "Explore Module", fr: "Explorer le Module" },
  facilityTag: { en: "SONATRACH AP-C3MR™ LIQUEFACTION FACILITY", fr: "USINE DE LIQUÉFACTION AP-C3MR™ SONATRACH" },
  testScheduleTitle: { en: "Maintenance & Test Schedule", fr: "Calendrier de Maintenance & d'Essais" },
  fastAlertsTitle: { en: "Active Fast Alerts", fr: "Alertes Rapides Actives" },
  catalogBadge: { en: "CATALOG", fr: "CATALOGUE" },
  integrationBadge: { en: "INTEGRATION", fr: "INTÉGRATION" },
  processBadge: { en: "PROCESS", fr: "PROCÉDÉ" },
  marketBadge: { en: "MARKET", fr: "MARCHÉ" },
  operationsBadge: { en: "OPERATIONS", fr: "OPÉRATIONS" },
  executiveBadge: { en: "EXECUTIVE", fr: "EXÉCUTIF" },
  credentialsBadge: { en: "CREDENTIALS", fr: "RÉFÉRENCES" },
  loading: { en: "Loading...", fr: "Chargement..." },
  viewAll: { en: "View All", fr: "Voir Tout" },
  collapse: { en: "Collapse", fr: "Réduire" },

  /* ─── AI ASSISTANT KEYS ─── */
  aiAssistant: { en: "GNL1Z AI Expert", fr: "Expert IA GNL1Z" },
  aiSubtitle: { en: "Industrial Asset Knowledgebase & Prediction Engine", fr: "Base de Connaissances & Moteur de Prédiction" },
  askAiPlaceholder: { en: "Ask about equipment, tests, failure predictions, tools...", fr: "Poser une question sur l'équipement, les essais, pannes, outils..." },
  predictChip: { en: "Predict next failing asset", fr: "Prédire la prochaine défaillance" },
  suggestToolsChip: { en: "Suggest tools for X01-E-501", fr: "Outils pour X01-E-501" },
  analyzeAlertsChip: { en: "Analyze recent fast alerts", fr: "Analyser les alertes récentes" },
  judgmentChip: { en: "Full engineering judgment for X01-F-502", fr: "Jugement d'ingénierie complet pour X01-F-502" },
  expertThinking: { en: "AI Expert is analyzing plant data...", fr: "L'Expert IA analyse les données de l'usine..." },
};

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
  t: (key: keyof typeof DICT | string) => string;
}

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("gnl1z-lang") as Lang) ?? "en");
  useEffect(() => { localStorage.setItem("gnl1z-lang", lang); }, [lang]);
  return (
    <I18nContext.Provider
      value={{
        lang,
        setLang,
        toggle: () => setLang((l) => (l === "en" ? "fr" : "en")),
        t: (key) => DICT[key]?.[lang] ?? String(key),
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
