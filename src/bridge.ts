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

async function mockAsk(kind: string, cred: string, model: string, hint: string): Promise<unknown> {
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
  if (!inTauri) return mockAsk(kind, cred, model, hint);
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
