// Pont vers le backend Rust. Hors Tauri (navigateur de test), un faux backend répond à la place.

export const inTauri = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd, args);
}

// ─── faux backend pour les tests dans le navigateur ────────────────────────────
// Toute clé non vide est acceptée ; « bad » dans la clé simule un refus.
const mockKeys: Record<string, string> = {};
try { Object.assign(mockKeys, JSON.parse(localStorage.getItem("lumo.mock.keys") ?? "{}")); } catch { /* rien */ }
const persistMock = () => { try { localStorage.setItem("lumo.mock.keys", JSON.stringify(mockKeys)); } catch { /* rien */ } };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Petite image PNG générée à la volée (pour simuler une IA qui dessine). */
function mockImage(): string {
  const c = document.createElement("canvas");
  c.width = 320; c.height = 200;
  const g = c.getContext("2d")!;
  const gr = g.createLinearGradient(0, 0, 320, 200);
  gr.addColorStop(0, "#1e3a8a"); gr.addColorStop(1, "#f59e0b");
  g.fillStyle = gr; g.fillRect(0, 0, 320, 200);
  g.fillStyle = "#fde68a"; g.beginPath(); g.arc(230, 70, 34, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#0f172a"; g.beginPath(); g.moveTo(0, 200); g.lineTo(110, 90); g.lineTo(190, 160); g.lineTo(250, 120); g.lineTo(320, 200); g.fill();
  return c.toDataURL("image/png").split(",")[1];
}

async function mockAsk(kind: string, cred: string, model: string, hint: string, body: any = {}): Promise<unknown> {
  await sleep(1200);
  const key = mockKeys[cred] ?? "";
  if (kind !== "openai" && !key) throw "http 401: aucun identifiant enregistré";
  if (/bad/.test(key)) throw "http 401: invalid api key";
  if (kind === "openai" && /off/.test(hint + model)) throw "network: error sending request for url (http://localhost:11434/v1/chat/completions)";
  if (/401/.test(hint)) throw "http 401: invalid x-api-key";
  if (/429/.test(hint)) throw "http 429: rate limit";
  if (/offline/.test(hint)) throw "network: dns error";
  const text = /code/i.test(hint)
    ? "Voici un exemple :\n```powershell\nGet-GPO -All | Select DisplayName\n```\nEt voilà !"
    : /^r[ée]ponds uniquement/i.test(hint) || /test de connexion/i.test(hint)
      ? "ok"
      : `Réponse simulée de **${model || kind}** : « ${hint.slice(0, 80)} ».\n\n- premier point\n- deuxième point`;
  // simulation de l'accès web
  const webInSystem = /Informations trouvées sur internet/.test(JSON.stringify(body.system ?? body.messages?.[0] ?? body.prompt ?? ""));
  if (kind === "claude" && body.tools) {
    const msgs = body.messages ?? [];
    const lastMsg = msgs[msgs.length - 1];
    if (/https?:\/\//.test(hint) && !(Array.isArray(lastMsg?.content) && lastMsg.content.some((b: any) => b.type === "tool_result")))
      return { content: [{ type: "text", text: "Je lis la page." }, { type: "tool_use", id: "tu_1", name: "fetch_page", input: { url: /https?:\/\/\S+/.exec(hint)![0] } }], stop_reason: "tool_use" };
    return { content: [
      { type: "server_tool_use", id: "s1", name: "web_search", input: { query: hint.slice(0, 60) } },
      { type: "web_search_tool_result", tool_use_id: "s1", content: [{ type: "web_search_result", url: "https://www.lemonde.fr/", title: "Le Monde" }] },
      { type: "text", text: "D'après les dernières informations, voici la réponse", citations: [{ type: "web_search_result_location", url: "https://www.lemonde.fr/", title: "Le Monde — actualité" }] },
      { type: "text", text: " (simulation avec recherche web)." }], stop_reason: "end_turn" };
  }
  if (kind === "gemini" && body.tools) {
    return { candidates: [{ content: { parts: [{ text: "Réponse Gemini appuyée sur Google Search (simulation)." }] }, finishReason: "STOP",
      groundingMetadata: { webSearchQueries: [hint.slice(0, 50)], groundingChunks: [{ web: { uri: "https://meteofrance.com/", title: "meteofrance.com" } }, { web: { uri: "https://www.lefigaro.fr/", title: "lefigaro.fr" } }] } }] };
  }
  if (kind === "openai" && body.tools) {
    const toolMsgs = (body.messages ?? []).filter((m: any) => m.role === "tool");
    if (!toolMsgs.length) return { choices: [{ message: { role: "assistant", content: null, tool_calls: [{ id: "c1", type: "function", function: { name: "web_search", arguments: JSON.stringify({ query: hint.slice(0, 60) }) } }] }, finish_reason: "tool_calls" }] };
    if (toolMsgs.length === 1) return { choices: [{ message: { role: "assistant", content: "", tool_calls: [{ id: "c2", type: "function", function: { name: "fetch_page", arguments: JSON.stringify({ url: "https://exemple1.fr/article-1" }) } }] }, finish_reason: "tool_calls" }] };
    return { choices: [{ message: { role: "assistant", content: `Selon mes recherches [1], voici ce que j'ai trouvé (${toolMsgs.length} outils utilisés).` }, finish_reason: "stop" }] };
  }
  if (webInSystem) {
    const t = "Réponse construite à partir des résultats de recherche fournis par Lumo [1][2].";
    if (kind === "openai") return { choices: [{ message: { role: "assistant", content: t }, finish_reason: "stop" }] };
    return { text: t };
  }
  const memoTag = /je m'appelle (\w+)/i.exec(hint) ? `\n\n<<retiens: L'utilisateur s'appelle ${/je m'appelle (\w+)/i.exec(hint)![1]}>>` : /j'utilise|je travaille/i.test(hint) ? `\n<<retiens: ${hint.replace(/^je /i, "L'utilisateur ").slice(0, 80)}>>` : "";
  const mem = /Ce dont tu te souviens[\s\S]*?\n((?:- .*\n)+)/.exec(JSON.stringify(body).replace(/\\n/g, "\n"));
  if (/qui suis[- ]je|tu te souviens/i.test(hint)) {
    const t2 = mem ? `Je me souviens que :\n${mem[1]}` : "Je ne sais rien de toi pour l'instant.";
    if (kind === "openai") return { choices: [{ message: { role: "assistant", content: t2 }, finish_reason: "stop" }] };
    if (kind === "gemini") return { candidates: [{ content: { parts: [{ text: t2 }] }, finishReason: "STOP" }] };
    if (kind === "claude") return { content: [{ type: "text", text: t2 }], stop_reason: "end_turn" };
    return { text: t2 };
  }
  if (memoTag) {
    const t3 = `Enchanté, c'est noté !${memoTag}`;
    if (kind === "claude") return { content: [{ type: "text", text: t3 }], stop_reason: "end_turn" };
    if (kind === "openai") return { choices: [{ message: { role: "assistant", content: t3 }, finish_reason: "stop" }] };
  }
  if (kind === "claude") return { content: [{ type: "text", text }], stop_reason: "end_turn" };
  if (kind === "gemini") {
    const parts: any[] = [{ text }];
    if (/image/.test(model) && /dessin|image|illustr/i.test(hint)) parts.push({ inlineData: { mimeType: "image/png", data: mockImage() } });
    return { candidates: [{ content: { parts }, finishReason: "STOP" }] };
  }
  if (kind === "openai") return { choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop" }] };
  return { text };
}

const MOCK_MODELS: Record<string, string[]> = {
  claude: ["claude-haiku-4-5-20251001", "claude-opus-5-5", "claude-sonnet-5-5"],
  gemini: ["gemini-2.5-flash", "gemini-2.5-flash-image", "gemini-2.5-pro"],
  openai: ["gpt-4.1", "gpt-4.1-mini", "gpt-5", "llama3.2:latest", "llava:7b", "qwen2.5-coder:7b"],
};

// ─── API ───────────────────────────────────────────────────────────────────────
/** Pour chaque id : un identifiant est-il enregistré ? */
export async function credStatus(ids: string[]): Promise<Record<string, boolean>> {
  if (!inTauri) return Object.fromEntries(ids.map((id) => [id, !!mockKeys[id]]));
  return invoke<Record<string, boolean>>("cred_status", { ids });
}
export async function credSave(id: string, secret: string): Promise<void> {
  if (!inTauri) { if (secret.trim()) mockKeys[id] = secret.trim(); else delete mockKeys[id]; persistMock(); return; }
  await invoke("cred_save", { id, secret });
}
export async function credDelete(id: string): Promise<void> {
  if (!inTauri) { delete mockKeys[id]; persistMock(); return; }
  await invoke("cred_delete", { id });
}
/** `hint` ne sert qu'au faux backend. */
export async function askProvider(kind: string, cred: string, model: string, body: unknown, hint = "", baseUrl?: string): Promise<any> {
  if (!inTauri) return mockAsk(kind, cred, model, hint, body);
  return invoke("ask_provider", { kind, cred, model, body, baseUrl: baseUrl ?? null });
}
export async function listModels(kind: string, cred: string, baseUrl?: string): Promise<string[]> {
  if (!inTauri) {
    await sleep(500);
    if (kind !== "openai" && !mockKeys[cred]) throw "http 401: aucun identifiant enregistré";
    if (/bad/.test(mockKeys[cred] ?? "")) throw "http 401: invalid api key";
    return MOCK_MODELS[kind] ?? [];
  }
  return invoke<string[]>("list_models", { kind, cred, baseUrl: baseUrl ?? null });
}
export async function copilotCheck(): Promise<string> {
  if (!inTauri) { await sleep(400); return "GitHub Copilot CLI 0.0.0 (simulé)"; }
  return invoke<string>("copilot_check");
}
export async function quitApp(): Promise<void> {
  if (!inTauri) return;
  await invoke("quit");
}
export async function openUrl(url: string): Promise<void> {
  if (!inTauri) { window.open(url, "_blank"); return; }
  const { openUrl } = await import("@tauri-apps/plugin-opener");
  await openUrl(url);
}
export async function onOpenSettings(cb: () => void): Promise<void> {
  if (!inTauri) return;
  const { listen } = await import("@tauri-apps/api/event");
  await listen("open-settings", cb);
}
export async function autostart(op: "get" | "set", value = false): Promise<boolean> {
  if (!inTauri) return false;
  const m = await import("@tauri-apps/plugin-autostart");
  if (op === "set") { if (value) await m.enable(); else await m.disable(); }
  return m.isEnabled();
}

/** Colle la fenêtre en haut de l'écran principal, sur toute la largeur, à cette hauteur (px logiques). */
export async function dock(height: number): Promise<void> {
  if (!inTauri) return;
  await invoke("dock", { height });
}
/** Réserve (ou libère) la bande du haut, comme la barre des tâches : les autres fenêtres s'arrêtent dessous. */
export async function appbar(enable: boolean, height: number): Promise<void> {
  if (!inTauri) return;
  await invoke("appbar", { enable, height });
}

// ─── accès à internet ──────────────────────────────────────────────────────────
export interface FetchedPage { url: string; status: number; content_type: string; body: string }

function mockPage(url: string): FetchedPage {
  if (/duckduckgo\.com/.test(url)) {
    const q = decodeURIComponent(/[?&]q=([^&]*)/.exec(url)?.[1] ?? "").replace(/\+/g, " ");
    const items = [1, 2, 3, 4, 5].map((i) => `<div class="result results_links web-result"><h2 class="result__title"><a class="result__a" href="//duckduckgo.com/l/?uddg=${encodeURIComponent(`https://exemple${i}.fr/article-${i}`)}&rut=x">Résultat ${i} pour ${q}</a></h2><a class="result__snippet">Extrait n°${i} : informations récentes sur ${q}.</a></div>`).join("");
    return { url, status: 200, content_type: "text/html", body: `<html><body>${items}</body></html>` };
  }
  return { url, status: 200, content_type: "text/html", body: `<html><head><title>Article de ${new URL(url).hostname}</title><script>x()</script></head><body><nav>menu</nav><article><h1>Titre de l'article</h1><p>Contenu publié le 1er octobre 2026 sur ${url}.</p><p>Deuxième paragraphe.</p></article><footer>pied</footer></body></html>` };
}

export async function webFetch(url: string): Promise<FetchedPage> {
  if (!inTauri) { await sleep(300); return mockPage(url); }
  return invoke<FetchedPage>("web_fetch", { url });
}
export async function webSearchApi(engine: string, query: string, count: number): Promise<any> {
  if (!inTauri) {
    await sleep(300);
    if (!mockKeys[`search-${engine}`]) throw "http 401: aucune clé enregistrée pour ce moteur de recherche";
    return { results: [1, 2, 3].map((i) => ({ title: `${engine} ${i} : ${query}`, url: `https://source${i}.com/`, content: `Extrait ${i}` })), web: { results: [] } };
  }
  return invoke("web_search_api", { engine, query, count });
}

// ─── mémoire partagée ──────────────────────────────────────────────────────────
export async function memoryLoad(): Promise<string> {
  if (!inTauri) return localStorage.getItem("lumo.mock.memory") ?? "[]";
  return invoke<string>("memory_load");
}
export async function memorySave(data: string): Promise<void> {
  if (!inTauri) { localStorage.setItem("lumo.mock.memory", data); return; }
  await invoke("memory_save", { data });
}
export async function memoryLocation(): Promise<string> {
  if (!inTauri) return "%APPDATA%\\fr.doitconsulting.lumo\\memoire.json (simulation)";
  return invoke<string>("memory_location");
}
