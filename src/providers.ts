// Format des requêtes et lecture des réponses, pour chaque type d'IA.
import { askProvider } from "./bridge";
import type { Connection, Kind } from "./connections";

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
}

export interface Reply { text: string; images: string[] }

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
    if (text || images.length) return { text, images };
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

export async function ask(c: Connection, system: string, history: ChatMsg[]): Promise<Reply> {
  const body = buildRequest(c, system, history);
  const last = [...history].reverse().find((m) => m.role === "user")?.text ?? "";
  const res = await askProvider(c.kind, c.id, c.model, body, last, c.baseUrl);
  return parseReply(c.kind, c.name, res);
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
