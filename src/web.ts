// Accès à internet pour les IA : recherche (DuckDuckGo sans clé, ou Tavily / Brave avec clé)
// et lecture de pages. Utilisé par les IA qui n'ont pas de recherche intégrée
// (ChatGPT, Mistral, Ollama, Copilot…) et comme solution de secours pour les autres.
import { webFetch, webSearchApi } from "./bridge";

export type Engine = "duckduckgo" | "tavily" | "brave";
export interface SearchResult { title: string; url: string; snippet: string }
export interface Source { title: string; url: string }

export const ENGINES: { id: Engine; label: string; note: string; keyUrl?: string }[] = [
  { id: "duckduckgo", label: "DuckDuckGo (gratuit, sans clé)", note: "Aucune inscription. Si DuckDuckGo ne répond pas, Lumo passe automatiquement par Bing." },
  { id: "tavily", label: "Tavily (clé gratuite, plus fiable)", note: "Moteur conçu pour les IA : 1 000 recherches gratuites par mois.", keyUrl: "https://app.tavily.com/home" },
  { id: "brave", label: "Brave Search (clé)", note: "Index indépendant, résultats de qualité. Nécessite une clé API Brave Search.", keyUrl: "https://api-dashboard.search.brave.com/app/keys" },
];

const clean = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

function parseHtml(html: string): Document {
  return new DOMParser().parseFromString(html, "text/html");
}

async function duckduckgo(query: string, n: number): Promise<SearchResult[]> {
  const page = await webFetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}&kl=fr-fr`);
  const doc = parseHtml(page.body);
  const out: SearchResult[] = [];
  doc.querySelectorAll(".result").forEach((r) => {
    if (r.classList.contains("result--ad") || out.length >= n) return;
    const a = r.querySelector<HTMLAnchorElement>("a.result__a");
    if (!a) return;
    const raw = a.getAttribute("href") ?? "";
    let url = raw;
    try { url = new URL(raw, "https://duckduckgo.com").searchParams.get("uddg") ?? new URL(raw, "https://duckduckgo.com").href; } catch { /* garde tel quel */ }
    if (!/^https?:\/\//.test(url) || /duckduckgo\.com\/y\.js/.test(url)) return;
    out.push({ title: clean(a.textContent ?? ""), url, snippet: clean(r.querySelector(".result__snippet")?.textContent ?? "") });
  });
  return out;
}

async function bing(query: string, n: number): Promise<SearchResult[]> {
  const page = await webFetch(`https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=fr&cc=FR`);
  const doc = parseHtml(page.body);
  const out: SearchResult[] = [];
  doc.querySelectorAll("li.b_algo").forEach((li) => {
    if (out.length >= n) return;
    const a = li.querySelector<HTMLAnchorElement>("h2 a");
    if (!a) return;
    let url = a.getAttribute("href") ?? "";
    try {
      const u = new URL(url);
      const enc = u.searchParams.get("u");
      if (/bing\.com$/.test(u.hostname) && enc?.startsWith("a1")) url = atob(enc.slice(2).replace(/-/g, "+").replace(/_/g, "/"));
    } catch { /* garde tel quel */ }
    if (!/^https?:\/\//.test(url)) return;
    out.push({ title: clean(a.textContent ?? ""), url, snippet: clean(li.querySelector(".b_caption p, p")?.textContent ?? "") });
  });
  return out;
}

async function duckduckgoLite(query: string, n: number): Promise<SearchResult[]> {
  const page = await webFetch(`https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}&kl=fr-fr`);
  const doc = parseHtml(page.body);
  const out: SearchResult[] = [];
  doc.querySelectorAll<HTMLAnchorElement>("a.result-link").forEach((a) => {
    if (out.length >= n) return;
    let url = a.getAttribute("href") ?? "";
    try { url = new URL(url, "https://duckduckgo.com").searchParams.get("uddg") ?? new URL(url, "https://duckduckgo.com").href; } catch { /* garde tel quel */ }
    if (!/^https?:\/\//.test(url) || /duckduckgo\.com/.test(new URL(url).hostname)) return;
    const snippet = a.closest("tr")?.nextElementSibling?.querySelector(".result-snippet")?.textContent ?? "";
    out.push({ title: clean(a.textContent ?? ""), url, snippet: clean(snippet) });
  });
  return out;
}

/** Cherche sur internet ; en cas d'échec du moteur choisi, essaie les moteurs gratuits. */
export async function search(query: string, engine: Engine, n = 6): Promise<SearchResult[]> {
  query = query.replace(/\s+/g, " ").trim().slice(0, 300);
  if (!query) return [];
  const errors: string[] = [];
  if (engine === "tavily" || engine === "brave") {
    try {
      const r = await webSearchApi(engine, query, n);
      const list = engine === "tavily"
        ? (r?.results ?? []).map((x: any) => ({ title: clean(x.title ?? ""), url: x.url, snippet: clean(x.content ?? "").slice(0, 400) }))
        : (r?.web?.results ?? []).map((x: any) => ({ title: clean(x.title ?? ""), url: x.url, snippet: clean(x.description ?? "") }));
      if (list.length) return list.slice(0, n);
    } catch (e) { errors.push(String((e as any)?.message ?? e)); }
  }
  for (const f of [duckduckgo, bing, duckduckgoLite]) {
    try { const list = await f(query, n); if (list.length) return list; } catch (e) { errors.push(String((e as any)?.message ?? e)); }
  }
  if (errors.length) throw new Error(`recherche impossible (${errors[0]})`);
  return [];
}

/** Télécharge une page et en extrait le texte lisible (sans menus, scripts ni pubs). */
export async function readPage(url: string, max = 9000): Promise<{ title: string; url: string; text: string }> {
  const page = await webFetch(url);
  if (page.status >= 400) throw new Error(`la page répond « erreur ${page.status} »`);
  if (!/html|xml/i.test(page.content_type) && page.content_type) return { title: url, url: page.url, text: page.body.slice(0, max) };
  const doc = parseHtml(page.body);
  doc.querySelectorAll("script, style, noscript, svg, nav, footer, header, aside, form, iframe, [role=navigation], [aria-hidden=true], .cookie, #cookie").forEach((e) => e.remove());
  const root = doc.querySelector("article, main, [role=main]") ?? doc.body;
  root?.querySelectorAll("p, div, li, h1, h2, h3, h4, tr, br, section").forEach((e) => e.append("\n"));
  const text = (root?.textContent ?? "").replace(/[ \t ]+/g, " ").replace(/\n\s*\n+/g, "\n\n").trim();
  return { title: clean(doc.title || url), url: page.url, text: text.slice(0, max) };
}

export const today = () => new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export function formatResults(list: SearchResult[]): string {
  if (!list.length) return "Aucun résultat.";
  return list.map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`).join("\n\n");
}

/** L'utilisateur demande-t-il explicitement d'aller sur internet ? (lien, « cherche sur internet », « /web »…) */
export function wantsWeb(text: string): boolean {
  const s = text.toLowerCase();
  return /^\s*(\/web\b|web\s*:)/.test(s)
    || /https?:\/\/\S+/.test(s)
    || /\b(sur|via|depuis|dans|avec) (internet|le web|le net|google|bing|duckduckgo)\b/.test(s)
    || /\b(en ligne|sur la toile)\b/.test(s) && /(cherch|recherch|regard|v[ée]rifi|trouv|consult|actualit|infos?\b)/.test(s)
    || /\b(fais|faire|lance|lancer|fait) (une |des )?recherches?\b/.test(s)
    || /\b(cherche|recherche|trouve|v[ée]rifie|regarde)[- ]moi\b/.test(s)
    || /\b(peux|pourrais|pouvez|pourriez)[- ](tu|vous) (me )?(chercher|rechercher|v[ée]rifier|regarder|trouver)\b.*\b(internet|web|en ligne|google|actualit|source)/.test(s)
    || /\b(googl(e|er|ise)|search the web|look (it )?up online)\b/.test(s)
    || /\b(derni[èe]res? (nouvelles|infos|informations|actualit[ée]s)|actualit[ée]s? (du jour|d'aujourd'hui|r[ée]centes?))\b/.test(s);
}
/** Retire le préfixe « /web » ou « web: » éventuel. */
export const stripWebPrefix = (t: string) => t.replace(/^\s*(\/web\b|web\s*:)\s*/i, "");

const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’`]/g, "'");

/** Salutation, remerciement, politesse ou bavardage : jamais besoin d'internet. */
export function isSmallTalk(text: string): boolean {
  const s = norm(text).replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();
  if (!s) return true;
  const words = s.split(" ");
  const polite = /^(bonjour|bonsoir|salut|coucou|hello|hey|hi|yo|re|bonne (journee|soiree|nuit)|merci|thanks|thank you|super|cool|top|parfait|genial|ok|okay|d'accord|daccord|ca marche|oui|non|bien|tres bien|bravo|au revoir|a plus|a bientot|bye|lumo|ca va|comment (ca va|vas tu|allez vous)|tu vas bien|quoi de neuf|bonne (chance|continuation)|desole|pardon|haha|lol|mdr)\b/;
  if (polite.test(s) && words.length <= 8 && !needsWeb(text)) return true;
  return words.length <= 2 && !/\d/.test(s) && !/https?:/.test(text);
}

/** La question dépend-elle d'informations récentes ou changeantes (donc d'internet) ? */
export function needsWeb(text: string): boolean {
  const s = norm(text);
  return wantsWeb(text)
    || /\b(aujourd'hui|ce (matin|soir|week-end|weekend|mois-ci)|cette (semaine|annee|nuit)|demain|hier|en ce moment|actuel(le)?(ment)?|maintenant|recemment|recent(e|es|s)?|dernier(e|es|s)? (version|mise a jour|sortie|actualite|nouvelle|resultat|match|episode|modele|iphone|update)|a jour|cette annee)\b/.test(s)
    || /\b(actualites?|news|infos? du jour|meteo|temperature|previsions?|quel temps|il pleut|neige|canicule|vigilance)\b/.test(s)
    || /\b(prix|tarifs?|combien coute|cout|cours (de|du|des) |bourse|action [a-z]+|bitcoin|crypto|taux (de change|d'interet|du livret)|inflation|smic)\b/.test(s)
    || /\b(horaires?|ouvert|fermee?|adresse de|telephone de|itineraire|trafic|greve|retard)\b/.test(s)
    || /\b(score|resultats? (du|des|de la)|classement|qui a gagne|match|election|sondage|elu|nomme|demission)\b/.test(s)
    || /\b(sortie (de|du|le)|date de sortie|est (il|elle) sorti|disponible|release|changelog|nouveautes? de|cve-\d|faille|vulnerabilite)\b/.test(s)
    || /\b(qui est (le|la|l') (actuel|president|premier ministre|ministre|pdg|ceo|directeur|maire))\b/.test(s)
    || /\b20(2[5-9]|3\d)\b/.test(s);
}
