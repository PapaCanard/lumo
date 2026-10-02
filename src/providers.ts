// Format des requêtes et lecture des réponses, pour chaque type d'IA.
import { askProvider } from "./bridge";
import { presetOf, type Connection, type Kind } from "./connections";
import { formatResults, readPage, search, today, type Engine, type Source } from "./web";

export interface Attachment {
  name: string;
  mime: string;
  kind: "text" | "image" | "pdf";
  size: number;
  text?: string; // kind = text
  data?: string; // base64, kind = image | pdf
}

export interface ChatMsg {
  role: "user" | "assistant";
  text: string;
  attachments?: Attachment[];
  /** Images produites par l'IA (data URL), non conservées dans l'historique. */
  images?: string[];
  conn?: string;
  label?: string;
  color?: string;
  error?: boolean;
  /** Pages consultées sur internet pour cette réponse. */
  sources?: Source[];
  /** Souvenirs ajoutés ou oubliés grâce à cette réponse. */
  memos?: string[];
}

export interface Reply { text: string; images: string[]; sources: Source[] }

/** Ce que l'IA est en train de faire sur internet (affiché pendant qu'elle réfléchit). */
export type WebStep = { kind: "search"; query: string } | { kind: "read"; url: string } | { kind: "web" };
export interface AskOptions {
  /** `presearch` : la question nécessite vraiment internet (sinon les IA sans outils répondent sans chercher). */
  web?: { engine: Engine; presearch?: boolean };
  onStep?: (s: WebStep) => void;
}

// ─── préparation de l'historique ───────────────────────────────────────────────
const fileBlock = (a: Attachment) => `[Fichier : ${a.name}]\n\`\`\`\n${a.text ?? ""}\n\`\`\``;

function fullText(m: ChatMsg): string {
  const texts = (m.attachments ?? []).filter((a) => a.kind === "text").map(fileBlock);
  return [m.text, ...texts].filter(Boolean).join("\n\n");
}

/** Retire les erreurs, fusionne les tours consécutifs du même rôle, commence par l'utilisateur. */
function normalize(history: ChatMsg[]): ChatMsg[] {
  const out: ChatMsg[] = [];
  for (const m of history) {
    if (m.error) continue;
    const prev = out[out.length - 1];
    if (prev && prev.role === m.role) {
      prev.text = [prev.text, m.text].filter(Boolean).join("\n\n");
      prev.attachments = [...(prev.attachments ?? []), ...(m.attachments ?? [])];
    } else out.push({ role: m.role, text: m.text, attachments: [...(m.attachments ?? [])] });
  }
  while (out.length && out[0].role !== "user") out.shift();
  // les pièces binaires ne sont renvoyées que pour les derniers échanges
  out.forEach((m, i) => {
    if (i < out.length - 3) m.attachments = (m.attachments ?? []).filter((a) => a.kind === "text");
  });
  return out;
}

export function buildRequest(c: Connection, system: string, history: ChatMsg[]): unknown {
  const msgs = normalize(history);
  if (!msgs.length) throw new Error("Rien à envoyer.");
  const has = (k: Attachment["kind"]) => msgs.some((m) => (m.attachments ?? []).some((a) => a.kind === k));
  if (has("image") && !c.caps.images) throw new Error(`${c.name} ne lit pas les images avec ce modèle : retire l'image, ou choisis une IA qui affiche le pictogramme « images ».`);
  if (has("pdf") && !c.caps.pdf) throw new Error(`${c.name} ne lit pas les PDF : colle le texte, ou choisis une IA qui affiche le pictogramme « PDF ».`);
  const model = c.model;

  if (c.kind === "claude") {
    return {
      model, max_tokens: 4096, system,
      messages: msgs.map((m) => ({
        role: m.role,
        content: [
          ...(m.attachments ?? []).filter((a) => a.kind === "image").map((a) => ({ type: "image", source: { type: "base64", media_type: a.mime, data: a.data } })),
          ...(m.attachments ?? []).filter((a) => a.kind === "pdf").map((a) => ({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.data } })),
          { type: "text", text: fullText(m) || "(pièce jointe)" },
        ],
      })),
    };
  }
  if (c.kind === "gemini") {
    return {
      systemInstruction: { parts: [{ text: system }] },
      ...(c.caps.imageGen ? { generationConfig: { responseModalities: ["TEXT", "IMAGE"] } } : {}),
      contents: msgs.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [
          ...(m.attachments ?? []).filter((a) => a.kind !== "text").map((a) => ({ inlineData: { mimeType: a.mime, data: a.data } })),
          { text: fullText(m) || "(pièce jointe)" },
        ],
      })),
    };
  }
  if (c.kind === "openai") {
    return {
      model, stream: false,
      messages: [
        { role: "system", content: system },
        ...msgs.map((m) => {
          const images = (m.attachments ?? []).filter((a) => a.kind === "image");
          const text = fullText(m) || "(pièce jointe)";
          if (!images.length) return { role: m.role, content: text };
          return { role: m.role, content: [...images.map((a) => ({ type: "image_url", image_url: { url: `data:${a.mime};base64,${a.data}` } })), { type: "text", text }] };
        }),
      ],
    };
  }
  // Copilot (CLI) : texte uniquement, l'historique est aplati dans un seul prompt.
  const convo = msgs.map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"} : ${fullText(m)}`).join("\n\n");
  return {
    prompt: `${system}\n\nRéponds uniquement au dernier message de l'utilisateur, sans préambule. Conversation :\n\n${convo}`,
  };
}

export function parseReply(kind: Kind, name: string, res: any): Reply {
  const done = (text: string, images: string[] = []): Reply => {
    if (text || images.length) return { text, images, sources: [] };
    throw new Error(`Réponse vide de ${name}.`);
  };
  if (kind === "claude") {
    const text = (res?.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
    if (!text) throw new Error(`Réponse vide de ${name} (${res?.stop_reason ?? "?"}).`);
    return done(text);
  }
  if (kind === "gemini") {
    if (res?.promptFeedback?.blockReason) throw new Error(`${name} a bloqué la demande (${res.promptFeedback.blockReason}).`);
    const parts = res?.candidates?.[0]?.content?.parts ?? [];
    const text = parts.filter((p: any) => !p.thought).map((p: any) => p.text ?? "").join("").trim();
    const images = parts.filter((p: any) => p.inlineData?.data && /^image\//.test(p.inlineData.mimeType ?? ""))
      .map((p: any) => `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`);
    if (!text && !images.length) throw new Error(`Réponse vide de ${name} (${res?.candidates?.[0]?.finishReason ?? "?"}).`);
    return done(text, images);
  }
  if (kind === "openai") {
    const text = String(res?.choices?.[0]?.message?.content ?? "").trim();
    if (!text) throw new Error(`Réponse vide de ${name} (${res?.choices?.[0]?.finish_reason ?? "?"}).`);
    return done(text);
  }
  return done(String(res?.text ?? "").trim());
}

const lastUser = (h: ChatMsg[]) => [...h].reverse().find((m) => m.role === "user")?.text ?? "";

async function askPlain(c: Connection, system: string, history: ChatMsg[]): Promise<Reply> {
  const body = buildRequest(c, system, history);
  const res = await askProvider(c.kind, c.id, c.model, body, lastUser(history), c.baseUrl);
  return parseReply(c.kind, c.name, res);
}

/** Envoie la conversation ; avec `opts.web`, l'IA peut chercher et lire des pages sur internet. */
export async function ask(c: Connection, system: string, history: ChatMsg[], opts: AskOptions = {}): Promise<Reply> {
  if (!opts.web) return askPlain(c, system, history);
  const ctx = new WebCtx(opts);
  const sys = `${system}\n\nNous sommes le ${today()}. ${WEB_RULES}`;
  const local = presetOf(c.preset).group === "local";
  try {
    if (c.kind === "claude") return await claudeWeb(c, sys, history, ctx);
    if (c.kind === "gemini" && !c.caps.imageGen) return await geminiWeb(c, sys, history, ctx);
    if (c.kind === "openai" && !local) return await toolsWeb(c, sys, history, ctx);
  } catch (e) {
    // Le modèle (ou le compte) refuse les outils : Lumo fait la recherche lui-même.
    if (!/http 4(00|22)|tool|function/i.test(String((e as any)?.message ?? e))) throw e;
  }
  return preSearch(c, sys, history, ctx);
}

const WEB_RULES = "Tu as accès à internet, mais ne t'en sers que si c'est nécessaire : actualité, prix, météo, horaires, versions de logiciels, toute information qui a pu changer récemment, ou un lien donné par l'utilisateur. Ne cherche jamais pour une salutation, un remerciement, une conversation, du code, de la rédaction ou une question de culture générale que tu connais. Quand tu cherches, cite tes sources sous la forme [1], [2]… et indique les dates quand elles comptent.";

class WebCtx {
  sources = new Map<string, Source>();
  constructor(public opts: AskOptions) {}
  step(s: WebStep) { try { this.opts.onStep?.(s); } catch { /* affichage seulement */ } }
  add(src: Source, max = 10) { if (src.url && !this.sources.has(src.url) && this.sources.size < max) this.sources.set(src.url, { title: src.title || src.url, url: src.url }); }
  list() { return [...this.sources.values()]; }

  /** Exécute un outil demandé par l'IA ; renvoie toujours du texte (jamais d'exception). */
  async run(name: string, input: any): Promise<string> {
    try {
      if (name === "web_search") {
        const q = String(input?.query ?? "").trim();
        this.step({ kind: "search", query: q });
        const res = await search(q, this.opts.web!.engine, 6);
        res.slice(0, 3).forEach((r) => this.add(r));
        return formatResults(res);
      }
      if (name === "fetch_page") {
        const url = String(input?.url ?? "").trim();
        this.step({ kind: "read", url });
        const p = await readPage(url);
        this.add({ title: p.title, url: p.url });
        return `Titre : ${p.title}\nAdresse : ${p.url}\n\n${p.text || "(page vide)"}`;
      }
      return `Outil inconnu : ${name}`;
    } catch (e) {
      return `Erreur : ${String((e as any)?.message ?? e)}`;
    }
  }
}

const FETCH_DESC = "Lit le texte d'une page web publique à partir de son adresse. À utiliser quand l'utilisateur donne un lien, ou pour lire en détail un résultat de recherche.";
const SEARCH_DESC = "Cherche sur internet (actualité, prix, météo, documentation, faits récents…). Renvoie des titres, adresses et extraits numérotés.";
const OPENAI_TOOLS = [
  { type: "function", function: { name: "web_search", description: SEARCH_DESC, parameters: { type: "object", properties: { query: { type: "string", description: "Requête de recherche, courte et précise" } }, required: ["query"] } } },
  { type: "function", function: { name: "fetch_page", description: FETCH_DESC, parameters: { type: "object", properties: { url: { type: "string", description: "Adresse complète (https://…)" } }, required: ["url"] } } },
];

/** Claude : recherche web intégrée d'Anthropic + lecture de page faite par Lumo. */
async function claudeWeb(c: Connection, sys: string, history: ChatMsg[], ctx: WebCtx): Promise<Reply> {
  const body: any = buildRequest(c, sys, history);
  body.tools = [
    { type: "web_search_20250305", name: "web_search", max_uses: 5 },
    { name: "fetch_page", description: FETCH_DESC, input_schema: { type: "object", properties: { url: { type: "string", description: "Adresse complète (https://…)" } }, required: ["url"] } },
  ];
  const messages: any[] = body.messages;
  const found: Source[] = [];
  let text = "";
  ctx.step({ kind: "web" });
  for (let i = 0; i < 8; i++) {
    const res = await askProvider("claude", c.id, c.model, { ...body, messages }, lastUser(history));
    const content: any[] = res?.content ?? [];
    for (const b of content) {
      if (b.type === "text") {
        text += b.text ?? "";
        for (const ct of b.citations ?? []) if (ct?.url) ctx.add({ title: ct.title, url: ct.url });
      } else if (b.type === "server_tool_use" && b.name === "web_search") ctx.step({ kind: "search", query: String(b.input?.query ?? "") });
      else if (b.type === "web_search_tool_result" && Array.isArray(b.content)) b.content.forEach((r: any) => r?.url && found.push({ title: r.title, url: r.url }));
    }
    messages.push({ role: "assistant", content });
    if (res?.stop_reason === "tool_use") {
      const results = [];
      for (const b of content.filter((x) => x.type === "tool_use")) results.push({ type: "tool_result", tool_use_id: b.id, content: await ctx.run(b.name, b.input) });
      messages.push({ role: "user", content: results });
      text = "";
      continue;
    }
    if (res?.stop_reason === "pause_turn") continue;
    break;
  }
  text = text.trim();
  if (!text) throw new Error(`Réponse vide de ${c.name}.`);
  if (!ctx.sources.size) found.slice(0, 5).forEach((s) => ctx.add(s));
  return { text, images: [], sources: ctx.list() };
}

/** Gemini : recherche Google intégrée (et lecture des liens si le modèle le permet). */
async function geminiWeb(c: Connection, sys: string, history: ChatMsg[], ctx: WebCtx): Promise<Reply> {
  let lastErr: unknown;
  ctx.step({ kind: "web" });
  for (const tools of [[{ google_search: {} }, { url_context: {} }], [{ google_search: {} }]]) {
    try {
      const body: any = buildRequest(c, sys, history);
      body.tools = tools;
      const res = await askProvider("gemini", c.id, c.model, body, lastUser(history));
      const reply = parseReply("gemini", c.name, res);
      const meta = res?.candidates?.[0]?.groundingMetadata;
      for (const q of meta?.webSearchQueries ?? []) ctx.step({ kind: "search", query: String(q) });
      for (const ch of meta?.groundingChunks ?? []) if (ch?.web?.uri) ctx.add({ title: ch.web.title, url: ch.web.uri });
      for (const u of res?.candidates?.[0]?.urlContextMetadata?.urlMetadata ?? res?.candidates?.[0]?.url_context_metadata?.url_metadata ?? []) {
        const url = u?.retrievedUrl ?? u?.retrieved_url;
        if (url) ctx.add({ title: url, url });
      }
      return { ...reply, sources: ctx.list() };
    } catch (e) {
      lastErr = e;
      if (!/http 400/.test(String((e as any)?.message ?? e))) throw e;
    }
  }
  throw lastErr;
}

/** API compatibles OpenAI (ChatGPT, Mistral, Groq, OpenRouter…) : l'IA appelle les outils de Lumo. */
async function toolsWeb(c: Connection, sys: string, history: ChatMsg[], ctx: WebCtx): Promise<Reply> {
  const base: any = buildRequest(c, sys, history);
  const messages: any[] = base.messages;
  const MAX = 6;
  for (let i = 0; i <= MAX; i++) {
    const body = i === MAX ? { ...base, messages } : { ...base, messages, tools: OPENAI_TOOLS, tool_choice: "auto" };
    const res = await askProvider("openai", c.id, c.model, body, lastUser(history), c.baseUrl);
    const msg = res?.choices?.[0]?.message ?? {};
    const calls: any[] = Array.isArray(msg.tool_calls) ? msg.tool_calls : [];
    if (calls.length && i < MAX) {
      calls.forEach((call, j) => { if (!call.id) call.id = `call_${i}_${j}`; if (!call.type) call.type = "function"; });
      messages.push({ role: "assistant", content: msg.content ?? "", tool_calls: calls });
      for (const call of calls) {
        let args: any = {};
        try { args = typeof call.function?.arguments === "string" ? JSON.parse(call.function.arguments || "{}") : call.function?.arguments ?? {}; } catch { /* arguments illisibles */ }
        messages.push({ role: "tool", tool_call_id: call.id, content: await ctx.run(call.function?.name ?? "", args) });
      }
      continue;
    }
    const text = String(msg.content ?? "").trim();
    if (!text) throw new Error(`Réponse vide de ${c.name} (${res?.choices?.[0]?.finish_reason ?? "?"}).`);
    return { text, images: [], sources: ctx.list() };
  }
  throw new Error(`${c.name} n'a pas terminé sa recherche.`);
}

/** Copilot, IA locales, ou modèle sans outils : Lumo cherche d'abord, puis donne les résultats à l'IA. */
async function preSearch(c: Connection, sys: string, history: ChatMsg[], ctx: WebCtx): Promise<Reply> {
  // Pas de besoin réel (mode « l'IA décide ») : ces IA ne savent pas chercher seules, on répond sans internet.
  if (ctx.opts.web?.presearch === false) return askPlain(c, sys, history);
  const users = history.filter((m) => m.role === "user").map((m) => m.text);
  const q = users[users.length - 1] ?? "";
  const urls = (q.match(/https?:\/\/[^\s<>"'\])]+/g) ?? []).slice(0, 2);
  const blocks: string[] = [];
  try {
    if (urls.length) {
      for (const url of urls) {
        ctx.step({ kind: "read", url });
        try { const p = await readPage(url, 8000); ctx.add({ title: p.title, url: p.url }); blocks.push(`[${ctx.sources.size}] ${p.title}\n${p.url}\n${p.text}`); }
        catch (e) { blocks.push(`Lecture de ${url} impossible : ${String((e as any)?.message ?? e)}`); }
      }
    } else if (q.replace(/[^\p{L}\p{N}]/gu, "").length >= 6) {
      // question courte (« et demain ? ») : on garde le contexte de la question précédente
      const followUp = q.length < 30 && users.length > 1 && /^(et|mais|alors|pourquoi|comment ça|et pour|et si|ok|d'accord|and|what about)\b/i.test(q.trim());
      const query = (followUp ? `${users[users.length - 2].slice(0, 120)} ${q}` : q).slice(0, 200);
      ctx.step({ kind: "search", query });
      const res = await search(query, ctx.opts.web!.engine, 6);
      res.forEach((r) => ctx.add(r));
      blocks.push(formatResults(res));
      const pages = await Promise.all(res.slice(0, 2).map(async (r, i) => {
        ctx.step({ kind: "read", url: r.url });
        try { const p = await readPage(r.url, 2500); return `Extrait de [${i + 1}] ${p.title} :\n${p.text}`; } catch { return ""; }
      }));
      blocks.push(...pages.filter(Boolean));
    }
  } catch (e) {
    blocks.push(`(La recherche sur internet a échoué : ${String((e as any)?.message ?? e)}. Dis-le à l'utilisateur si sa question en dépendait.)`);
  }
  const sys2 = blocks.length
    ? `${sys}\n\n--- Informations trouvées sur internet par Lumo le ${today()} ---\n${blocks.join("\n\n")}\n--- Fin des informations ---\nAppuie-toi sur ces informations quand elles sont utiles et cite les sources sous la forme [1], [2]…`
    : sys;
  const reply = await askPlain(c, sys2, history);
  return { ...reply, sources: ctx.list() };
}

/** Petit appel pour vérifier qu'une IA répond (assistant d'ajout, bouton « Tester »). */
export async function testConnection(c: Connection): Promise<string> {
  const r = await ask({ ...c, caps: { ...c.caps, imageGen: false } }, "Réponds uniquement par le mot : ok", [{ role: "user", text: "Test de connexion." }]);
  return r.text || "(réponse reçue)";
}

/** Message d'erreur lisible pour l'utilisateur (l'original reste dans `raw`). */
export function explainError(c: Pick<Connection, "name" | "kind" | "baseUrl">, raw: unknown): string {
  const m = String((raw as any)?.message ?? raw ?? "");
  const name = c.name;
  const local = c.kind === "openai" && /localhost|127\.0\.0\.1|192\.168\.|\.local\b/.test(c.baseUrl ?? "");
  if (/cli-missing/.test(m)) {
    return "La CLI GitHub Copilot est introuvable. Installe-la avec « winget install GitHub.Copilot.CLI », puis réessaie.";
  }
  if (local && /network/.test(m)) return `Impossible de joindre ${name} (${c.baseUrl}). Le serveur (Ollama, LM Studio…) est-il lancé ?`;
  if (c.kind === "openai" && /http 404/.test(m)) return `Le serveur ne connaît pas ce modèle (ou cette adresse). Utilise « Lister les modèles ». ${detail(m)}`;
  if (/http 40[13]/.test(m)) return `${name} a refusé la clé. Vérifie-la dans les réglages (⚙). ${detail(m)}`;
  if (/http 429/.test(m)) return `${name} limite les requêtes (quota ou débit atteint). Réessaie dans un instant. ${detail(m)}`;
  if (/http 5\d\d/.test(m)) return `${name} est surchargé ou en panne. Réessaie dans un instant. ${detail(m)}`;
  if (/http 400/.test(m)) return `${name} a refusé la demande. ${detail(m)}`;
  if (/timeout/.test(m)) return `${name} met trop de temps à répondre.`;
  if (/network/.test(m)) return `Impossible de joindre ${name}. Vérifie ta connexion.`;
  return m.replace(/^(http \d+|copilot|network):\s*/, "") || "Erreur inconnue.";
}
const detail = (m: string) => { const d = m.replace(/^http \d+:\s*/, "").slice(0, 160); return d ? `(${d})` : ""; };
