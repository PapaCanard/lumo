// Ce que Lumo comprend de ce que tu écris, de ce que tu déposes et de ce que l'IA répond.
import type { EmoteId } from "./character";

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

interface Rule { id: EmoteId; re: RegExp }

// Ordre = priorité : la première règle qui correspond gagne.
const RULES: Rule[] = [
  { id: "steam", re: /\b(enerve|rage|wtf|ca marche pas|marche pas|ras le bol|insupportable|horrible)\b/ },
  { id: "rush", re: /\b(urgent|urgence|vite|asap|deadline|rapidement|en retard|tout de suite)\b/ },
  { id: "laugh", re: /\b(lol|mdr|ptdr|haha+|hihi|drole)\b|😂|🤣/ },
  { id: "love", re: /\b(amour|love|adore|j'aime|calin|bisou|coeur)\b|❤|😍|🥰/ },
  { id: "party", re: /\b(bravo|felicitations|genial|parfait|excellent|youpi|yes|victoire|gagne|reussi)\b|🎉|🥳/ },
  { id: "love", re: /\b(merci|thanks|thank you|thx)\b/ },
  { id: "wave", re: /\b(bonjour|salut|coucou|hello|hey|bonsoir|hi|yo)\b|👋/ },
  { id: "sleepy", re: /\b(dormir|sieste|bonne nuit|fatigue|sleep|goodnight|zzz|dodo)\b/ },
  { id: "sad", re: /\b(triste|decu|galere|panne|deprime|sad|tired|desole|dommage|malheureusement)\b|😢|😭/ },
  { id: "shield", re: /\b(mot de passe|password|securite|vulnerab\w*|malware|virus|firewall|audit|gpo|defender|chiffrement|rgpd|conformite|habilitation|active directory|pentest|cve)\b/ },
  { id: "code", re: /\b(code|bug|erreur|error|exception|stack|script|fonction|function|compile\w*|git|powershell|python|javascript|typescript|rust|sql|regex|api|json|yaml|bash|debug|variable|boucle|classe)\b|```/ },
  { id: "idea", re: /\b(idee|idea|brainstorm\w*|propose|suggere|imagine|et si|astuce|trouver un moyen)\b/ },
  { id: "coins", re: /\b(argent|prix|facture|devis|budget|money|price|invoice|vente|ventes|tarif|euros?|cout|paiement|stripe)\b|€|\$/ },
  { id: "music", re: /\b(musique|chanson|music|song|playlist|chanter|concert)\b|🎵/ },
  { id: "sun", re: /\b(soleil|meteo|beau temps|chaud|vacances|plage|weekend|week-end)\b|☀/ },
  { id: "rain", re: /\b(pluie|pleut|neige|orage|parapluie|rain)\b/ },
  { id: "yum", re: /\b(manger|cafe|the|pizza|dejeuner|diner|resto|restaurant|coffee|faim|gateau|recette|cuisine)\b/ },
  { id: "clock", re: /\b(heure|demain|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|rdv|reunion|meeting|planning|agenda|calendrier|echeance|date|quand)\b/ },
  { id: "search", re: /\b(cherche|recherche|trouve|trouver|search|find|ou est|liste|compare\w*)\b/ },
  { id: "curious", re: /\b(pourquoi|comment|qu'est-ce|quoi|why|how|what|qui|lequel|quel|quelle|combien)\b|\?\s*$/ },
];

/** Réaction à ce que l'utilisateur est en train de taper. */
export function reactToTyping(text: string): EmoteId | null {
  const t = norm(text.slice(-240));
  if (t.trim().length < 2) return null;
  for (const r of RULES) if (r.re.test(t)) return r.id;
  if (text.length > 600) return "reading";
  return null;
}

/** Réaction à la réponse de l'IA. */
export function reactToReply(text: string): EmoteId {
  const t = norm(text);
  if (/```/.test(text)) return "code";
  if (/\b(desole|je m'excuse|sorry|je ne peux pas|i can't|i cannot|impossible de)\b/.test(t)) return "sheepish";
  if (/\b(bravo|felicitations|excellent|parfait)\b/.test(t)) return "party";
  if (/\b(attention|danger|risque|securite|vulnerab\w*)\b/.test(t)) return "shield";
  if (/\b(idee|suggestion|astuce|conseil)\b/.test(t)) return "idea";
  if (text.length > 1400) return "reading";
  if (/\b(haha|lol|mdr|drole)\b|😂/.test(t)) return "laugh";
  return text.length > 500 ? "proud" : "nod";
}

/** Réaction à une erreur venant du backend. */
export function reactToError(message: string): EmoteId {
  const m = message.toLowerCase();
  if (/ne lit que/.test(m)) return "sheepish";
  if (/http 40[13]|cli-missing|clé|cle |api key|permission/.test(m)) return "key";
  if (/http 429|quota|rate|surcharg|overload|http 529/.test(m)) return "hot";
  if (/network|timeout|dns|connect/.test(m)) return "offline";
  if (/http 404/.test(m)) return "key";
  return "dizzy";
}

const EXT: Record<string, EmoteId> = {
  png: "camera", jpg: "camera", jpeg: "camera", gif: "camera", webp: "camera", bmp: "camera", heic: "camera", svg: "camera",
  pdf: "reading", doc: "reading", docx: "reading", odt: "reading", txt: "reading", md: "reading", rtf: "reading",
  csv: "chart", xlsx: "chart", xls: "chart", tsv: "chart",
  zip: "box", rar: "box", "7z": "box", tar: "box", gz: "box", msi: "box", exe: "box",
  mp3: "music", wav: "music", flac: "music", ogg: "music", m4a: "music",
  js: "code", ts: "code", py: "code", rs: "code", ps1: "code", sh: "code", bat: "code", cmd: "code", json: "code", yaml: "code", yml: "code",
  html: "code", css: "code", sql: "code", xml: "code", cs: "code", java: "code", go: "code", cpp: "code", c: "code", php: "code", log: "code", ini: "code", reg: "code",
  pem: "shield", cer: "shield", crt: "shield", evtx: "shield",
};

export function extOf(name: string): string { return name.split(".").pop()?.toLowerCase() ?? ""; }
export function reactToFile(name: string): EmoteId { return EXT[extOf(name)] ?? "curious"; }
