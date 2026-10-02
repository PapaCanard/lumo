// Mémoire persistante de Lumo, partagée par toutes les IA configurées.
// Les souvenirs sont rangés dans un fichier (memoire.json, dans le dossier de Lumo) et
// rappelés à chaque IA dans sa consigne. Pour en ajouter, une IA écrit à la fin de sa
// réponse une balise <<retiens: …>> (ou <<oublie: …>>) que Lumo retire de l'affichage.
import { memoryLoad, memorySave } from "./bridge";

export interface Memo { id: string; text: string; at: string; by?: string }

let memos: Memo[] = [];
let loaded = false;
const listeners = new Set<() => void>();

export const onMemoryChange = (f: () => void) => { listeners.add(f); return () => listeners.delete(f); };
const changed = () => { void memorySave(JSON.stringify(memos, null, 1)).catch(() => {}); listeners.forEach((f) => f()); };

export async function loadMemory(): Promise<void> {
  try {
    const data = JSON.parse(await memoryLoad());
    memos = Array.isArray(data) ? data.filter((m) => m && typeof m.text === "string").map((m) => ({ id: m.id || newId(), text: m.text, at: m.at || new Date().toISOString(), by: m.by })) : [];
  } catch { memos = []; }
  loaded = true;
}
export const allMemos = () => [...memos];
export const memoryLoaded = () => loaded;

const newId = () => `m-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Jamais de secrets en mémoire (clés, mots de passe, cartes, IBAN). */
function sensitive(t: string): boolean {
  return /(sk-[a-z0-9_-]{10,}|AIza[0-9A-Za-z_-]{20,}|github_pat_|gh[pousr]_[A-Za-z0-9]{20,}|\b(?:\d[ -]?){13,19}\b|\bFR\d{2}[ ]?\d{4}|mot de passe|password|passwd)/i.test(t);
}

export function addMemo(text: string, by?: string): Memo | null {
  text = text.replace(/\s+/g, " ").trim().replace(/^[-•*]\s*/, "").slice(0, 400);
  if (text.length < 3 || sensitive(text)) return null;
  const n = norm(text);
  if (memos.some((m) => { const o = norm(m.text); return o === n || o.includes(n); })) return null;
  // une version plus complète remplace l'ancienne
  memos = memos.filter((m) => !n.includes(norm(m.text)));
  const memo: Memo = { id: newId(), text, at: new Date().toISOString(), by };
  memos.push(memo);
  if (memos.length > 300) memos = memos.slice(-300);
  changed();
  return memo;
}

/** Oublie les souvenirs qui correspondent au texte donné ; renvoie ceux retirés. */
export function forget(query: string): Memo[] {
  const q = norm(query);
  if (!q) return [];
  const words = q.split(" ").filter((w) => w.length > 2);
  const hit = (m: Memo) => {
    const t = norm(m.text);
    if (t.includes(q) || q.includes(t)) return true;
    return words.length > 0 && words.filter((w) => t.includes(w)).length / words.length >= 0.6;
  };
  const gone = memos.filter(hit);
  if (gone.length) { memos = memos.filter((m) => !hit(m)); changed(); }
  return gone;
}

export function updateMemo(id: string, text: string) {
  const m = memos.find((x) => x.id === id);
  if (!m) return;
  text = text.replace(/\s+/g, " ").trim();
  if (!text) { removeMemo(id); return; }
  if (sensitive(text)) return;
  m.text = text.slice(0, 400);
  changed();
}
export function removeMemo(id: string) { memos = memos.filter((m) => m.id !== id); changed(); }
export function clearMemory() { memos = []; changed(); }

/** Bloc ajouté à la consigne de chaque IA. */
export function memoryPrompt(): string {
  const rules = "Tu as une mémoire persistante, partagée avec les autres IA de Lumo. Si l'utilisateur te demande de retenir quelque chose, ou te donne une information durable et utile sur lui (prénom, métier, entreprise, préférences, outils, projets en cours), ajoute à la toute fin de ta réponse une ligne <<retiens: le fait en une phrase courte, à la 3e personne>>. S'il te demande d'oublier quelque chose : <<oublie: le fait>>. Une balise par fait, seulement si c'est vraiment utile pour plus tard ; jamais de mot de passe, clé, numéro de carte ou donnée bancaire. Ne commente pas ces balises.";
  if (!memos.length) return `\n\n${rules}`;
  let list = "";
  for (const m of [...memos].reverse()) {
    const line = `- ${m.text}\n`;
    if (list.length + line.length > 6000) break;
    list = line + list;
  }
  return `\n\n${rules}\n\nCe dont tu te souviens (mémoire de Lumo) :\n${list}Utilise ces souvenirs quand ils sont utiles, sans les réciter.`;
}

const TAG = /<<\s*(retiens|retenir|m[ée]mo(?:rise)?|souviens|oublie|oublier)\s*:\s*([\s\S]*?)\s*>>/gi;

/** Retire les balises mémoire d'une réponse et applique les ajouts / oublis. */
export function applyMemoryTags(reply: string, by: string, userText: string): { text: string; added: string[]; removed: string[] } {
  const added: string[] = [], removed: string[] = [];
  const text = reply.replace(TAG, (_m, verb: string, fact: string) => {
    if (/^oubli/i.test(verb)) forget(fact).forEach((m) => removed.push(m.text));
    else { const m = addMemo(fact, by); if (m) added.push(m.text); }
    return "";
  }).replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  // Demande explicite non traitée par l'IA : Lumo retient la phrase lui-même.
  if (!added.length && !removed.length) {
    const ask = /^\s*(?:lumo[, ]+)?(?:retiens|souviens[- ]toi|rappelle[- ]toi|n'oublie pas|m[ée]morise|note)\s*(?:bien\s*)?(?:que|qu'|:)?\s*(.{3,})$/i.exec(userText.trim());
    if (ask) {
      const fact = ask[1].replace(/[.!]+$/, "").replace(/^je /i, "L'utilisateur ").replace(/^j'/i, "L'utilisateur ").replace(/^mon /i, "Son ").replace(/^ma /i, "Sa ").replace(/^mes /i, "Ses ");
      const m = addMemo(fact.charAt(0).toUpperCase() + fact.slice(1), by);
      if (m) added.push(m.text);
    }
    const del = /^\s*(?:lumo[, ]+)?oublie\s+(?:que\s+|qu')?(.{3,})$/i.exec(userText.trim());
    if (del) forget(del[1]).forEach((m) => removed.push(m.text));
  }
  return { text, added, removed };
}
