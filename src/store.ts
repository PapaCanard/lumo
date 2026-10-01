// Préférences et historique : uniquement dans le navigateur de l'appli (jamais de secrets ici).
import type { Connection } from "./connections";
import type { Engine } from "./web";

export interface Prefs {
  /** Les IA ajoutées, dans l'ordre de la barre. `undefined` = premier lancement de la V2 (migration à faire). */
  connections?: Connection[];
  active: string; // id de l'IA sélectionnée
  barColor: string;
  system: string;
  sound: boolean;
  alwaysOnTop: boolean;
  reserve: boolean;
  /** Accès à internet pour les IA. */
  web: boolean;
  webEngine: Engine;
}

/** Anciennes préférences (v1), lues une seule fois pour la migration. */
export interface LegacyPrefs { provider?: string; models?: Record<string, string>; localUrl?: string }

export interface StoredMessage {
  role: "user" | "assistant";
  text: string;
  conn?: string;
  label?: string;
  color?: string;
  provider?: string; // v1
  files?: string[];
  error?: boolean;
  sources?: { title: string; url: string }[];
}

export const DEFAULT_SYSTEM =
  "Tu es Lumo, un petit compagnon de bureau. Réponds en français, de façon claire et concise, sauf si on te demande autre chose.";

export const DEFAULT_BAR = "#121214";

export const DEFAULT_PREFS: Prefs = {
  active: "",
  barColor: DEFAULT_BAR,
  system: DEFAULT_SYSTEM,
  sound: true,
  alwaysOnTop: true,
  reserve: true,
  web: true,
  webEngine: "duckduckgo",
};

const K_PREFS = "lumo.prefs";
const K_HIST = "lumo.history";

function read<T>(key: string): T | null {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* stockage indisponible */ }
}

export function loadPrefs(): { prefs: Prefs; legacy: LegacyPrefs } {
  const raw = read<Partial<Prefs> & LegacyPrefs>(K_PREFS) ?? {};
  const { provider, models, localUrl, ...rest } = raw;
  const prefs: Prefs = { ...DEFAULT_PREFS, ...rest };
  if (!/^#[0-9a-f]{6}$/i.test(prefs.barColor)) prefs.barColor = DEFAULT_BAR;
  return { prefs, legacy: { provider, models, localUrl } };
}
export function savePrefs(p: Prefs) { write(K_PREFS, p); }
export function loadHistory(): StoredMessage[] { return read<StoredMessage[]>(K_HIST) ?? []; }
export function saveHistory(h: StoredMessage[]) { write(K_HIST, h.slice(-60)); }
