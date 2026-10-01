// Lumo — point d'entrée : assemble le personnage, le chat, les réglages et la fenêtre.
import "./style.css";
import { Lumo, type EmoteId } from "./character";
import { credStatus, inTauri, onOpenSettings, openUrl } from "./bridge";
import { CAP_LABELS, eyeColor, guessCaps, luminance, presetOf, type Caps, type Connection } from "./connections";
import { readFile, MAX_FILES } from "./files";
import { ICON } from "./icons";
import { renderMarkdown } from "./markdown";
import { ask, explainError, type Attachment, type ChatMsg, type WebStep } from "./providers";
import { reactToError, reactToFile, reactToReply, reactToTyping } from "./reactions";
import { renderSettings, type SettingsOptions } from "./settings";
import { setSoundEnabled, sfx } from "./sound";
import { loadHistory, loadPrefs, saveHistory, savePrefs, type LegacyPrefs, type StoredMessage } from "./store";
import { currentMode, place, setAlwaysOnTop, setMode, setReserve, trackCursor } from "./windowing";

const app = document.getElementById("app")!;
app.innerHTML = `
  <header class="bar" id="bar">
    <div class="visor"><canvas id="lumo" aria-label="Lumo, ton compagnon"></canvas></div>
    <span class="brand">lumo<b>.</b></span>
    <nav class="pills" id="pills" aria-label="Choisir l'IA"></nav>
    <div class="caps" id="caps" aria-label="Ce que sait faire le modèle"></div>
    <label class="cmdline">
      <span class="prompt" id="prompt">&gt;</span>
      <textarea id="input" rows="1" placeholder="Tape ta question, ou dépose un fichier…" spellcheck="false" autocomplete="off"></textarea>
      <span class="kbd">Entrée ↵</span>
    </label>
    <div class="actions">
      <button class="icon-btn" id="btn-attach" title="Joindre un fichier (ou dépose-le sur la barre)">${ICON.clip}</button>
      <button class="icon-btn" id="btn-settings" title="Réglages : mes IA, couleur, options">${ICON.gear}</button>
      <button class="icon-btn" id="btn-toggle" title="Ouvrir / fermer la console (Échap)">${ICON.chevron}</button>
    </div>
  </header>
  <section class="console" id="console">
    <div class="view" id="view-chat">
      <div class="messages" id="messages" aria-live="polite"></div>
      <div class="chips" id="chips"></div>
      <input type="file" id="file" multiple hidden />
    </div>
    <div class="view" id="view-settings" hidden></div>
  </section>
  <div class="veil" id="veil" hidden><span>Dépose le fichier ici</span></div>
`;
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const messagesEl = $("messages"), inputEl = $<HTMLTextAreaElement>("input"), chipsEl = $("chips");
const pillsEl = $("pills"), capsEl = $("caps"), canvas = $<HTMLCanvasElement>("lumo"), promptEl = $("prompt");
const viewChat = $("view-chat"), viewSettings = $("view-settings"), veil = $("veil");

// ─── état ──────────────────────────────────────────────────────────────────────
const { prefs, legacy } = loadPrefs();
/** Pour chaque IA ajoutée : une clé est-elle enregistrée ? */
let keys: Record<string, boolean> = {};
const conns = () => prefs.connections ?? [];
const active = (): Connection | undefined => conns().find((c) => c.id === prefs.active) ?? conns()[0];

const history: ChatMsg[] = loadHistory().map((m: StoredMessage) => ({
  role: m.role, text: m.text, conn: m.conn, label: m.label ?? (m.provider ? m.provider[0].toUpperCase() + m.provider.slice(1) : undefined),
  color: m.color, error: m.error, sources: m.sources,
  attachments: (m.files ?? []).map((name) => ({ name, mime: "", kind: "text" as const, size: 0, text: "" })),
}));
let pending: Attachment[] = [];
let busy = false;
let view: "chat" | "settings" = "chat";
let placeholderTimer = 0;
const PLACEHOLDER = "Tape ta question, ou dépose un fichier…";

const lumo = new Lumo(canvas, 42);
lumo.onSfx = sfx;

function persist() {
  saveHistory(history.map((m) => ({
    role: m.role, text: m.images?.length ? `${m.text}${m.text ? "\n\n" : ""}_(${m.images.length} image${m.images.length > 1 ? "s" : ""} générée${m.images.length > 1 ? "s" : ""}, non conservée${m.images.length > 1 ? "s" : ""})_` : m.text,
    conn: m.conn, label: m.label, color: m.color, error: m.error, sources: m.sources, files: (m.attachments ?? []).map((a) => a.name),
  })));
}
const savePrefsNow = () => savePrefs(prefs);

async function refreshKeys() {
  try { keys = await credStatus(conns().map((c) => c.id)); } catch { /* garde l'état précédent */ }
  renderPills();
}

/** Premier lancement de la V2 : reprend les clés de la v1 (rangées sous « claude », « gemini », « copilot », « local »). */
async function migrate(old: LegacyPrefs) {
  if (prefs.connections) return;
  const list: Connection[] = [];
  try {
    const st = await credStatus(["claude", "gemini", "copilot", "local"]);
    const mk = (id: string, preset: string, model: string, baseUrl?: string): Connection => {
      const p = presetOf(preset);
      return { id, name: p.label.replace(/\s*\(.*\)\s*$/, ""), preset, kind: p.kind, model, baseUrl, color: p.color, caps: guessCaps(preset, model) };
    };
    if (st.claude) list.push(mk("claude", "claude", old.models?.claude || "claude-sonnet-5-5"));
    if (st.gemini) list.push(mk("gemini", "gemini", old.models?.gemini || "gemini-2.5-flash"));
    if (st.copilot) list.push(mk("copilot", "copilot", old.models?.copilot ?? ""));
    if (old.models?.local) {
      const url = old.localUrl || "http://localhost:11434/v1";
      list.push({ ...mk("local", /:1234/.test(url) ? "lmstudio" : "ollama", old.models.local, url), name: "IA locale" });
    }
  } catch { /* pas de migration possible : on part de zéro */ }
  prefs.connections = list;
  if (!list.some((c) => c.id === prefs.active)) prefs.active = list.find((c) => c.id === old.provider)?.id ?? list[0]?.id ?? "";
  savePrefsNow();
}

// ─── couleur de la barre ───────────────────────────────────────────────────────
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt))));
  return `#${((f((n >> 16) & 255) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, "0")}`;
}
function applyBarColor(c: string) {
  const light = luminance(c) > 0.4;
  const root = document.documentElement;
  root.style.setProperty("--bar-1", shade(c, light ? 0.35 : 0.05));
  root.style.setProperty("--bar-2", c);
  root.style.setProperty("--console-bg", light ? "#0e0e10" : shade(c, -0.25));
  root.classList.toggle("bar-light", light);
}

// ─── IA active ─────────────────────────────────────────────────────────────────
const ACCENT_NONE = "#9fb4c8";
function applyActive(animate: boolean) {
  const c = active();
  if (c && prefs.active !== c.id) prefs.active = c.id;
  app.style.setProperty("--accent", c?.color ?? ACCENT_NONE);
  promptEl.textContent = c ? `${c.name.toLowerCase().replace(/\s+/g, "-")}>` : "lumo>";
  lumo.setTint(c?.id ?? "", c ? eyeColor(c.color) : ACCENT_NONE, animate);
  renderPills();
  renderCaps();
}

function renderCaps() {
  const c = active();
  capsEl.replaceChildren();
  capsEl.hidden = !c;
  if (!c) return;
  const icons: Record<keyof Caps, string> = { files: ICON.capFiles, images: ICON.capImages, pdf: ICON.capPdf, imageGen: ICON.capImageGen };
  const summary: string[] = [];
  (Object.keys(icons) as (keyof Caps)[]).forEach((k) => {
    const i = document.createElement("span");
    i.className = `cap-ico ${c.caps[k] ? "on" : "off"}`;
    i.innerHTML = icons[k];
    i.title = `${CAP_LABELS[k]} : ${c.caps[k] ? "oui" : "non"}`;
    capsEl.append(i);
    summary.push(`${c.caps[k] ? "✓" : "✗"} ${CAP_LABELS[k]}`);
  });
  capsEl.title = `${c.name}${c.model ? ` (${c.model})` : ""}\n${summary.join("\n")}`;
  // globe : accès à internet, activable d'un clic
  const g = document.createElement("button");
  g.className = `cap-ico web ${prefs.web ? "on" : "off"}`;
  g.innerHTML = ICON.globe;
  g.title = prefs.web ? "Accès à internet : activé (clic pour couper)" : "Accès à internet : coupé (clic pour activer)";
  g.onclick = () => {
    prefs.web = !prefs.web;
    savePrefsNow();
    renderCaps();
    lumo.play(prefs.web ? "search" : "sleepy");
    say(prefs.web ? "Accès à internet activé." : "Accès à internet coupé.", 2500);
    if (view === "settings" && currentMode() === "console") void openSettings();
  };
  capsEl.append(g);
}

let pillsKey = "";
function renderPills() {
  // Recréés seulement si la liste change ; sinon on déplace l'indicateur, qui glisse.
  const key = JSON.stringify(conns().map((c) => [c.id, c.name, c.color])) + (conns().length ? "" : "empty");
  if (key !== pillsKey) {
    pillsKey = key;
    pillsEl.replaceChildren();
    const ind = document.createElement("span");
    ind.className = "pill-ind";
    pillsEl.append(ind);
    for (const c of conns()) {
      const b = document.createElement("button");
      b.dataset.id = c.id;
      b.style.setProperty("--pc", c.color);
      b.innerHTML = `<span class="lbl"></span><span class="state"></span>`;
      (b.querySelector(".lbl") as HTMLElement).textContent = c.name;
      b.onclick = () => {
        if (prefs.active !== c.id) { prefs.active = c.id; savePrefsNow(); applyActive(true); renderMessages(); }
      };
      pillsEl.append(b);
    }
    const add = document.createElement("button");
    add.className = conns().length ? "pill add" : "pill add solo";
    add.innerHTML = conns().length ? ICON.plus : `${ICON.plus}<span class="lbl">Ajouter une IA</span>`;
    add.title = "Ajouter une IA";
    add.onclick = () => void openSettings({ wizard: true });
    pillsEl.append(add);
  }
  for (const b of pillsEl.querySelectorAll<HTMLButtonElement>("button[data-id]")) {
    const c = conns().find((x) => x.id === b.dataset.id)!;
    const p = presetOf(c.preset);
    const ok = keys[c.id] || p.secret === "optional";
    b.className = "pill" + (c.id === active()?.id ? " active" : "");
    b.title = `${c.name} — ${p.label}${c.model ? ` · ${c.model}` : ""}${ok ? "" : " (clé manquante)"}`;
    b.querySelector(".state")!.className = `state ${ok ? "on" : "warn"}`;
  }
  requestAnimationFrame(moveIndicator);
}
function moveIndicator() {
  const ind = pillsEl.querySelector<HTMLElement>(".pill-ind"), act = pillsEl.querySelector<HTMLElement>(".pill.active");
  if (!ind) return;
  ind.style.opacity = act ? "1" : "0";
  if (!act) return;
  ind.style.width = `${act.offsetWidth}px`;
  ind.style.transform = `translateX(${act.offsetLeft}px)`;
  ind.style.setProperty("--pc", active()?.color ?? ACCENT_NONE);
}
window.addEventListener("resize", () => moveIndicator());
document.fonts?.ready.then(() => moveIndicator());

/** Fait clignoter l'onglet d'une IA qui vient d'être ajoutée. */
function flashPill(id: string) {
  requestAnimationFrame(() => {
    const b = pillsEl.querySelector<HTMLElement>(`button[data-id="${id}"]`);
    b?.classList.add("born");
    setTimeout(() => b?.classList.remove("born"), 1600);
  });
}

// ─── fenêtre / vues ────────────────────────────────────────────────────────────
async function openPanel() {
  clearPlaceholder();
  await setMode("console");
  view === "settings" ? openSettings() : showView("chat");
  lumo.wake();
}
async function closePanel() {
  $("btn-settings").classList.remove("on");
  await setMode("bar");
}
function showView(v: "chat" | "settings") {
  view = v;
  $("btn-settings").classList.toggle("on", v === "settings");
  viewChat.hidden = v !== "chat";
  viewSettings.hidden = v !== "settings";
}
async function openSettings(opts: SettingsOptions = {}) {
  clearPlaceholder();
  if (currentMode() !== "console") await setMode("console");
  showView("settings");
  await renderSettings(viewSettings, {
    prefs, get keys() { return keys; }, save: savePrefsNow, refreshKeys,
    connectionsChanged: (selectId) => { applyActive(!!selectId); renderMessages(); if (selectId) flashPill(selectId); },
    onBarColor: applyBarColor,
    onWeb: () => renderCaps(),
    onSound: setSoundEnabled, onTop: (on) => void setAlwaysOnTop(on), onReserve: (on) => void setReserve(on),
    clearHistory: () => { history.length = 0; persist(); renderMessages(); },
    react: (k) => lumo.play(k === "saved" ? "nod" : k === "ok" ? "proud" : k === "added" ? "party" : k === "deleted" ? "sad" : "key"),
    close: () => { showView("chat"); setTimeout(() => inputEl.focus(), 30); },
  }, opts);
}
$("btn-settings").onclick = () => void (view === "settings" && currentMode() === "console" ? showView("chat") : openSettings());
$("btn-toggle").onclick = () => void (currentMode() === "console" ? closePanel() : openPanel());
void onOpenSettings(() => void openSettings());
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") { if (view === "settings") showView("chat"); else if (currentMode() === "console") void closePanel(); }
});
inputEl.addEventListener("focus", () => clearPlaceholder());

// ─── message court dans la barre (quand la console est fermée) ─────────────────
function preview(text: string): string {
  const t = text.replace(/```[\s\S]*?```/g, " [code] ").replace(/[*_`#>]/g, "").replace(/\s+/g, " ").trim();
  return t.length > 160 ? `${t.slice(0, 157)}…` : t;
}
function say(text: string, ms = 9000) {
  if (currentMode() === "console") return;
  inputEl.placeholder = text;
  clearTimeout(placeholderTimer);
  placeholderTimer = window.setTimeout(clearPlaceholder, ms);
}
function clearPlaceholder() {
  clearTimeout(placeholderTimer);
  inputEl.placeholder = PLACEHOLDER;
}

// ─── messages ──────────────────────────────────────────────────────────────────
function renderMessages() {
  messagesEl.replaceChildren();
  if (!history.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    const c = active();
    empty.innerHTML = `<strong></strong><p></p>`;
    (empty.querySelector("strong") as HTMLElement).textContent = `lumo — compagnon IA`;
    (empty.querySelector("p") as HTMLElement).textContent = c
      ? `Je transmets tes questions à ${c.name}${c.model ? ` (${c.model})` : ""}. Tape dans la barre, ou dépose un fichier.`
      : "Aucune IA pour l'instant : clique sur « + Ajouter une IA » dans la barre.";
    messagesEl.append(empty);
    return;
  }
  for (const m of history) {
    const row = document.createElement("div");
    row.className = `msg ${m.role}${m.error ? " error" : ""}`;
    if (m.role === "assistant") row.style.setProperty("--pc", m.color ?? conns().find((c) => c.id === m.conn)?.color ?? ACCENT_NONE);
    if (m.role === "assistant") {
      const who = document.createElement("div");
      who.className = "who";
      who.innerHTML = `<span class="dot"></span><span></span>`;
      (who.lastElementChild as HTMLElement).textContent = m.error ? "Oups" : m.label ?? conns().find((c) => c.id === m.conn)?.name ?? "IA";
      row.append(who);
    }
    const files = m.attachments ?? [];
    if (files.length) {
      const f = document.createElement("div");
      f.className = "files";
      for (const a of files) { const c = document.createElement("span"); c.className = "file"; c.textContent = a.name; f.append(c); }
      row.append(f);
    }
    const body = document.createElement("div");
    body.className = "body";
    if (m.role === "assistant" && !m.error) body.innerHTML = renderMarkdown(m.text);
    else body.textContent = m.text;
    row.append(body);
    if (m.images?.length) {
      const gal = document.createElement("div");
      gal.className = "gen-images";
      m.images.forEach((src, i) => {
        const a = document.createElement("a");
        a.href = src;
        a.download = `lumo-image-${Date.now()}-${i + 1}.png`;
        a.title = "Clique pour enregistrer l'image";
        const img = document.createElement("img");
        img.src = src;
        img.alt = "Image générée";
        a.append(img);
        gal.append(a);
      });
      row.append(gal);
    }
    if (m.sources?.length) {
      const src = document.createElement("div");
      src.className = "sources";
      const lbl = document.createElement("span");
      lbl.className = "src-lbl";
      lbl.innerHTML = `${ICON.globe}<span>Sources</span>`;
      src.append(lbl);
      m.sources.forEach((sct, i) => {
        const a = document.createElement("a");
        a.className = "ext src";
        a.href = sct.url;
        let host = sct.url;
        try { host = new URL(sct.url).hostname.replace(/^www\./, ""); } catch { /* rien */ }
        a.textContent = `${i + 1}. ${/^https?:|vertexaisearch/.test(sct.title) || !sct.title ? host : sct.title.slice(0, 48)}`;
        a.title = `${sct.title}\n${sct.url}`;
        src.append(a);
      });
      row.append(src);
    }
    messagesEl.append(row);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
messagesEl.addEventListener("click", (e) => {
  const link = (e.target as HTMLElement).closest<HTMLAnchorElement>("a.ext");
  if (link) { e.preventDefault(); if (/^https?:\/\//.test(link.href)) void openUrl(link.href); return; }
  const btn = (e.target as HTMLElement).closest("button.copy");
  if (!btn) return;
  const code = btn.parentElement?.querySelector("code")?.textContent ?? "";
  void navigator.clipboard?.writeText(code).then(() => { btn.textContent = "Copié"; setTimeout(() => (btn.textContent = "Copier"), 1200); });
});

function addThinkingRow() {
  const row = document.createElement("div");
  row.className = "msg assistant thinking";
  row.style.setProperty("--pc", active()?.color ?? ACCENT_NONE);
  row.id = "thinking-row";
  row.innerHTML = `<div class="who"><span class="dot"></span><span></span></div><div class="body"><span class="dots"><i></i><i></i><i></i></span><span class="web-step" id="web-step"></span></div>`;
  (row.querySelector(".who span:last-child") as HTMLElement).textContent = active()?.name ?? "IA";
  messagesEl.append(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// ─── pièces jointes ────────────────────────────────────────────────────────────
function renderChips() {
  chipsEl.replaceChildren();
  pending.forEach((a, i) => {
    const c = document.createElement("span");
    c.className = "chip";
    const n = document.createElement("span");
    n.textContent = a.name;
    const x = document.createElement("button");
    x.innerHTML = ICON.x;
    x.title = "Retirer";
    x.onclick = () => { pending.splice(i, 1); renderChips(); };
    c.append(n, x);
    chipsEl.append(c);
  });
}

async function addFiles(files: File[]) {
  if (!files.length) return;
  if (currentMode() !== "console") await openPanel();
  let first = true;
  for (const f of files) {
    if (pending.length >= MAX_FILES) { notice(`Maximum ${MAX_FILES} fichiers à la fois.`); lumo.play("sheepish"); break; }
    const r = await readFile(f);
    if (!r.ok) { notice(`${r.name} : ${r.reason}.`); lumo.play("sheepish"); continue; }
    pending.push(r.att);
    renderChips();
    if (first) { first = false; lumo.eat(r.att.kind, reactToFile(r.att.name) as EmoteId); }
  }
}

function notice(text: string) {
  const row = document.createElement("div");
  row.className = "notice";
  row.textContent = text;
  messagesEl.append(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  setTimeout(() => row.remove(), 6000);
}

$("btn-attach").onclick = () => $<HTMLInputElement>("file").click();
$<HTMLInputElement>("file").onchange = (e) => {
  const input = e.target as HTMLInputElement;
  void addFiles([...(input.files ?? [])]);
  input.value = "";
};
window.addEventListener("paste", (e) => {
  const files = [...(e.clipboardData?.files ?? [])];
  if (files.length) { e.preventDefault(); void addFiles(files); }
});

// glisser-déposer
let dragDepth = 0;
const hasFiles = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes("Files");
window.addEventListener("dragenter", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  if (++dragDepth === 1) { veil.hidden = false; lumo.play("ooh"); }
});
window.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
window.addEventListener("dragleave", (e) => {
  if (!hasFiles(e)) return;
  if (--dragDepth <= 0) { dragDepth = 0; veil.hidden = true; lumo.stopEmote("ooh"); }
});
window.addEventListener("drop", (e) => {
  if (!hasFiles(e)) return;
  e.preventDefault();
  dragDepth = 0;
  veil.hidden = true;
  lumo.stopEmote("ooh");
  void addFiles([...(e.dataTransfer?.files ?? [])]);
});

// ─── saisie : Lumo réagit à ce que tu écris ────────────────────────────────────
let listenTimer = 0, reactTimer = 0, lastLen = 0, lastReact: { id: EmoteId | null; at: number } = { id: null, at: 0 };
inputEl.addEventListener("input", () => {
  lumo.setListening(true);
  lumo.typingPulse();
  clearTimeout(listenTimer);
  listenTimer = window.setTimeout(() => lumo.setListening(false), 2500);
  clearTimeout(reactTimer);
  reactTimer = window.setTimeout(() => {
    const grew = inputEl.value.length > lastLen;
    lastLen = inputEl.value.length;
    if (!grew || busy) return;
    const id = reactToTyping(inputEl.value);
    const now = performance.now();
    if (id && (id !== lastReact.id || now - lastReact.at > 9000)) { lastReact = { id, at: now }; lumo.play(id); }
  }, 450);
});
inputEl.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); void send(); }
});

// ─── envoi ─────────────────────────────────────────────────────────────────────
async function send() {
  if (busy) return;
  const text = inputEl.value.trim();
  if (!text && !pending.length) return;
  const c = active();
  if (!c) {
    lumo.play("key");
    void openSettings({ wizard: true });
    return;
  }
  if (!keys[c.id] && presetOf(c.preset).secret === "required") {
    lumo.play("key");
    notice(`La clé de ${c.name} est manquante : ajoute-la dans ⚙.`);
    return;
  }
  // Pièces jointes que ce modèle ne sait pas lire : on prévient avant d'envoyer.
  if (pending.some((a) => a.kind === "image") && !c.caps.images) { lumo.play("sheepish"); notice(`${c.name} ne lit pas les images avec ce modèle (pictogramme barré). Retire l'image ou change d'IA.`); return; }
  if (pending.some((a) => a.kind === "pdf") && !c.caps.pdf) { lumo.play("sheepish"); notice(`${c.name} ne lit pas les PDF. Retire le fichier ou change d'IA.`); return; }
  if (currentMode() !== "console") void openPanel();
  history.push({ role: "user", text, attachments: pending });
  pending = [];
  inputEl.value = "";
  lastLen = 0;
  clearTimeout(reactTimer);
  lumo.setListening(false);
  renderChips();
  renderMessages();
  addThinkingRow();
  busy = true;
  sfx("send");
  lumo.setThinking(true);
  try {
    const reply = await ask(c, prefs.system, history, { web: prefs.web ? { engine: prefs.webEngine } : undefined, onStep: showStep });
    history.push({ role: "assistant", text: reply.text, images: reply.images, sources: reply.sources, conn: c.id, label: c.name, color: c.color });
    lumo.setThinking(false);
    lumo.play(reply.images.length ? "camera" : reactToReply(reply.text));
    if (currentMode() !== "console") { say(preview(reply.text || "Image générée.")); void openPanel(); }
  } catch (err) {
    const raw = String((err as any)?.message ?? err);
    history.push({ role: "assistant", text: explainError(c, err), conn: c.id, label: c.name, color: c.color, error: true });
    lumo.setThinking(false);
    lumo.play(reactToError(raw));
    if (currentMode() !== "console") void openPanel();
  } finally {
    busy = false;
    persist();
    renderMessages();
  }
}

/** Ce que fait l'IA sur internet, affiché sous les trois points. */
let lastStepEmote = 0;
function showStep(st: WebStep) {
  const el = document.getElementById("web-step");
  if (el) {
    let host = "";
    if (st.kind === "read") { try { host = new URL(st.url).hostname.replace(/^www\./, ""); } catch { host = st.url; } }
    el.textContent = st.kind === "search" ? `Recherche : « ${st.query.slice(0, 70)} »` : st.kind === "read" ? `Lecture de ${host}` : "Recherche sur internet…";
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }
  const now = performance.now();
  if (now - lastStepEmote > 2500) { lastStepEmote = now; lumo.play(st.kind === "read" ? "reading" : "search"); }
}

// ─── interactions avec Lumo : clic, survol ─────────────────────────────────────
canvas.addEventListener("click", () => lumo.poke());
canvas.addEventListener("pointerenter", () => { if (!lumo.currentEmote) lumo.lookAt(0, 0); });

// ─── démarrage ─────────────────────────────────────────────────────────────────
async function boot() {
  setSoundEnabled(prefs.sound);
  applyBarColor(prefs.barColor);
  await migrate(legacy);
  await refreshKeys();
  applyActive(false);
  renderMessages();
  await place(prefs.reserve);
  void setAlwaysOnTop(prefs.alwaysOnTop);
  lumo.start();
  lumo.wake(false);
  trackCursor(() => { const r = canvas.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, (nx, ny) => lumo.lookAt(nx, ny));
  setTimeout(() => {
    lumo.play("wave");
    say(conns().length ? "Salut ! Pose ta question ou dépose un fichier." : "Salut ! Clique sur « + Ajouter une IA » pour commencer.", 8000);
  }, 700);
  if (!inTauri) (window as any).__lumo = lumo; // pour les tests visuels dans le navigateur
}
void boot();
