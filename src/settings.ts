// Réglages : mes IA (ajout guidé, modification, suppression), apparence de la barre, options générales.
import { autostart, copilotCheck, credDelete, credSave, credStatus, listModels, openUrl, quitApp } from "./bridge";
import { CAP_LABELS, PRESETS, guessCaps, newId, presetOf, type Caps, type Connection, type Preset } from "./connections";
import { ICON } from "./icons";
import { explainError, testConnection } from "./providers";
import { DEFAULT_BAR, DEFAULT_SYSTEM, type Prefs } from "./store";
import { ENGINES, search, type Engine } from "./web";
import { addMemo, allMemos, clearMemory, onMemoryChange, removeMemo, updateMemo } from "./memory";
import { memoryLocation } from "./bridge";

export interface SettingsHost {
  prefs: Prefs;
  /** Pour chaque IA : un identifiant est-il enregistré ? */
  readonly keys: Record<string, boolean>;
  save(): void;
  refreshKeys(): Promise<void>;
  /** Les IA ont changé (ajout, nom, couleur, suppression) : redessiner la barre. */
  connectionsChanged(selectId?: string): void;
  onBarColor(color: string): void;
  /** L'accès à internet a été activé ou coupé. */
  onWeb(): void;
  onSound(on: boolean): void;
  onTop(on: boolean): void;
  onReserve(on: boolean): void;
  clearHistory(): void;
  react(kind: "saved" | "deleted" | "ok" | "fail" | "added"): void;
  close(): void;
}

export interface SettingsOptions { wizard?: boolean; flash?: string }

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
}
function input(type: string, value = "", placeholder = ""): HTMLInputElement {
  const i = el("input");
  i.type = type;
  i.value = value;
  i.placeholder = placeholder;
  i.spellcheck = false;
  i.autocomplete = "off";
  return i;
}
function field(label: string, control: HTMLElement, extra?: HTMLElement): HTMLLabelElement {
  const l = el("label", "", label);
  if (extra) { const row = el("div", "field-row"); row.append(control, extra); l.append(row); } else l.append(control);
  return l;
}
function resultLine() {
  const r = el("div", "result");
  r.setAttribute("aria-live", "polite");
  const set = (text: string, ok: boolean | null) => { r.textContent = text; r.className = "result" + (ok === true ? " good" : ok === false ? " bad" : ""); };
  return { el: r, set };
}
function helpLink(p: Preset): HTMLElement | null {
  if (!p.help) return null;
  const a = el("a", "link", p.help.label);
  a.href = p.help.url;
  a.onclick = (ev) => { ev.preventDefault(); void openUrl(p.help!.url); };
  return a;
}
const shortName = (p: Preset) => p.label.replace(/\s*\(.*\)\s*$/, "");

/** Rangée de pictogrammes de capacités ; `editable` rend cliquables ceux que l'utilisateur peut corriger. */
export function capsRow(caps: Caps, editable?: { kind: Connection["kind"]; onChange: (c: Caps) => void }): HTMLElement {
  const row = el("div", "caps-row");
  const icons: Record<keyof Caps, string> = { files: ICON.capFiles, images: ICON.capImages, pdf: ICON.capPdf, imageGen: ICON.capImageGen };
  (Object.keys(icons) as (keyof Caps)[]).forEach((k) => {
    const canEdit = !!editable && ((k === "images" && editable.kind === "openai") || (k === "imageGen" && editable.kind === "gemini"));
    const b = el(canEdit ? "button" : "span", `cap ${caps[k] ? "on" : "off"}${canEdit ? " editable" : ""}`);
    b.innerHTML = `${icons[k]}<span>${CAP_LABELS[k]}</span>`;
    b.title = `${CAP_LABELS[k]} : ${caps[k] ? "oui" : "non"}${canEdit ? " — clique pour corriger" : ""}`;
    if (canEdit) (b as HTMLButtonElement).onclick = () => { caps[k] = !caps[k]; editable!.onChange(caps); };
    row.append(b);
  });
  return row;
}

export async function renderSettings(root: HTMLElement, host: SettingsHost, opts: SettingsOptions = {}): Promise<void> {
  root.replaceChildren();
  const { prefs } = host;
  const conns = prefs.connections ?? [];

  const top = el("div", "set-top");
  const back = el("button", "icon-btn");
  back.innerHTML = ICON.back;
  back.title = "Retour à la conversation";
  back.onclick = () => host.close();
  top.append(back, el("h2", "", "Réglages"));
  root.append(top);

  const scroll = el("div", "set-scroll");
  root.append(scroll);

  // ─── mes IA ─────────────────────────────────────────────────────────────────
  const head = el("div", "section-head");
  const h = el("h3", "", "Mes IA");
  const bAdd = el("button", "btn primary add");
  bAdd.innerHTML = `${ICON.plus}<span>Ajouter une IA</span>`;
  head.append(h, el("span", "spacer"), bAdd);
  scroll.append(head);
  scroll.append(el("p", "muted small", "Seules les IA ajoutées ici apparaissent dans la barre. Les clés sont rangées dans le Gestionnaire d'identifiants de Windows : jamais écrites sur le disque, jamais réaffichées."));

  const wizardHost = el("div", "wizard-host");
  scroll.append(wizardHost);
  const openWizard = () => { bAdd.disabled = true; renderWizard(wizardHost, host, () => { bAdd.disabled = false; }); wizardHost.scrollIntoView({ block: "nearest" }); };
  bAdd.onclick = openWizard;

  const list = el("div", "conn-list");
  scroll.append(list);
  if (!conns.length) {
    const empty = el("div", "conn-empty");
    empty.innerHTML = `<strong>Aucune IA pour l'instant.</strong><span>Clique sur « Ajouter une IA » : Claude, Gemini, ChatGPT, Mistral, Copilot, Ollama…</span>`;
    list.append(empty);
  }
  for (const c of conns) list.append(connectionCard(c, root, host, opts.flash === c.id));
  if (opts.wizard || !conns.length) openWizard();

  // ─── accès à internet ───────────────────────────────────────────────────────
  scroll.append(webPanel(host));

  // ─── mémoire ────────────────────────────────────────────────────────────────
  scroll.append(memoryPanel(host));

  // ─── apparence ──────────────────────────────────────────────────────────────
  const look = el("section", "panel");
  look.append(el("h3", "", "Apparence"));
  const swatches: [string, string][] = [
    ["#0c0c0c", "Noir cmd"], [DEFAULT_BAR, "Anthracite"], ["#1f2328", "Graphite"], ["#0f1b33", "Bleu nuit"],
    ["#1d1530", "Aubergine"], ["#0f2a22", "Sapin"], ["#2a1016", "Bordeaux"], ["#e9e9ee", "Clair"],
  ];
  const colorRow = el("div", "color-row");
  const picker = input("color", prefs.barColor);
  picker.className = "color-input";
  picker.title = "Choisir une couleur";
  const hexOut = el("code", "hex", prefs.barColor);
  const apply = (c: string, persist: boolean) => {
    prefs.barColor = c;
    picker.value = c;
    hexOut.textContent = c;
    sw.querySelectorAll<HTMLButtonElement>(".swatch").forEach((b) => b.classList.toggle("on", b.dataset.c === c));
    host.onBarColor(c);
    if (persist) host.save();
  };
  picker.oninput = () => apply(picker.value, false);
  picker.onchange = () => apply(picker.value, true);
  const sw = el("div", "swatches");
  for (const [c, name] of swatches) {
    const b = el("button", "swatch" + (c === prefs.barColor ? " on" : ""));
    b.dataset.c = c;
    b.style.background = c;
    b.title = name;
    b.onclick = () => apply(c, true);
    sw.append(b);
  }
  colorRow.append(picker, hexOut, sw);
  look.append(field("Couleur de la barre", colorRow));
  scroll.append(look);

  // ─── général ────────────────────────────────────────────────────────────────
  const gen = el("section", "panel");
  gen.append(el("h3", "", "Général"));
  const toggle = (label: string, checked: boolean, on: (v: boolean) => void) => {
    const l = el("label", "toggle");
    const c = input("checkbox");
    c.checked = checked;
    c.onchange = () => on(c.checked);
    l.append(c, el("span", "", label));
    return l;
  };
  gen.append(
    toggle("Petits bruitages", prefs.sound, (v) => { prefs.sound = v; host.save(); host.onSound(v); }),
    toggle("Toujours au premier plan", prefs.alwaysOnTop, (v) => { prefs.alwaysOnTop = v; host.save(); host.onTop(v); }),
    toggle("Réserver la place en haut de l'écran (comme la barre des tâches)", prefs.reserve, (v) => { prefs.reserve = v; host.save(); host.onReserve(v); }),
  );
  const auto = toggle("Lancer Lumo au démarrage de Windows", false, (v) => { void autostart("set", v); });
  gen.append(auto);
  void autostart("get").then((on) => { (auto.querySelector("input") as HTMLInputElement).checked = on; });

  const sys = el("textarea");
  sys.rows = 3;
  sys.value = prefs.system;
  sys.onchange = () => { prefs.system = sys.value.trim() || DEFAULT_SYSTEM; host.save(); };
  gen.append(field("Consigne donnée à l'IA (personnalité, langue…)", sys));

  const row = el("div", "btn-row");
  const bClear = el("button", "btn", "Effacer la conversation");
  bClear.onclick = () => { host.clearHistory(); bClear.textContent = "Conversation effacée"; };
  const bQuit = el("button", "btn danger", "Quitter Lumo");
  bQuit.onclick = () => { void quitApp(); };
  row.append(bClear, bQuit);
  gen.append(row);
  scroll.append(gen);
}

// ─── assistant d'ajout ──────────────────────────────────────────────────────────
function renderWizard(box: HTMLElement, host: SettingsHost, onClose: () => void) {
  const id = newId(); // devient l'id de l'IA et le nom de sa clé dans Windows
  let keySaved = false;
  let preset: Preset | null = null;
  let tested = false;

  box.replaceChildren();
  const card = el("section", "wizard");
  box.append(card);

  const top = el("div", "wizard-top");
  const steps = el("ol", "steps");
  ["Choisir l'IA", "Se connecter", "Tester", "Nommer"].forEach((t, i) => { const li = el("li", "", t); li.dataset.i = String(i); steps.append(li); });
  const bCancel = el("button", "icon-btn");
  bCancel.innerHTML = ICON.x;
  bCancel.title = "Annuler";
  top.append(el("strong", "", "Nouvelle IA"), steps, el("span", "spacer"), bCancel);
  card.append(top);
  const setStep = (n: number) => steps.querySelectorAll("li").forEach((li) => {
    const i = Number(li.dataset.i);
    li.className = i < n ? "done" : i === n ? "now" : "";
  });
  setStep(0);

  const close = async () => {
    if (keySaved) { try { await credDelete(id); } catch { /* rien */ } }
    box.replaceChildren();
    onClose();
  };
  bCancel.onclick = () => void close();

  // étape 1 : menu déroulant
  const select = el("select", "preset-select");
  const ph = el("option", "", "Choisis une IA…");
  ph.value = "";
  ph.disabled = true;
  ph.selected = true;
  select.append(ph);
  for (const [group, label] of [["cloud", "Dans le cloud (clé API)"], ["local", "Sur ton PC ou ton réseau"]] as const) {
    const og = el("optgroup");
    og.label = label;
    for (const p of PRESETS.filter((x) => x.group === group)) { const o = el("option", "", p.label); o.value = p.id; og.append(o); }
    select.append(og);
  }
  card.append(field("Quelle IA veux-tu ajouter ?", select));

  const body = el("div", "wizard-body");
  card.append(body);

  select.onchange = async () => {
    preset = presetOf(select.value);
    tested = false;
    if (keySaved) { await credDelete(id).catch(() => {}); keySaved = false; }
    renderBody();
  };

  function renderBody() {
    const p = preset!;
    body.replaceChildren();
    card.style.setProperty("--pc", p.color);
    setStep(1);

    const note = el("p", "muted small", p.note);
    const link = helpLink(p);
    if (link) note.append(" ", link);
    body.append(note);

    const url = input("text", p.baseUrl ?? "", "http://localhost:11434/v1");
    if (p.kind === "openai" && p.editableUrl) body.append(field("Adresse de l'API", url));

    const key = input("password", "", p.secretHint);
    body.append(field(p.secretLabel, key));

    const model = input("text", p.defaultModel, p.modelHint);
    const dl = el("datalist");
    dl.id = `wiz-models-${id}`;
    model.setAttribute("list", dl.id);
    const bList = el("button", "btn", p.kind === "copilot" ? "Vérifier la CLI" : "Lister les modèles");
    body.append(field("Modèle", model, bList), dl);

    const res = resultLine();
    const bTest = el("button", "btn primary", "Tester la connexion");
    const actions = el("div", "btn-row");
    actions.append(bTest);
    body.append(actions, res.el);

    const finish = el("div", "wizard-finish");
    body.append(finish);

    const draft = (): Connection => ({
      id, name: shortName(p), preset: p.id, kind: p.kind, model: model.value.trim(),
      baseUrl: p.kind === "openai" ? (p.editableUrl ? url.value.trim() : p.baseUrl) : undefined,
      color: p.color, caps: guessCaps(p.id, model.value.trim()),
    });
    const invalidate = () => { if (tested) { tested = false; finish.replaceChildren(); setStep(1); } };
    [url, key, model].forEach((i) => i.addEventListener("input", invalidate));

    /** Enregistre la clé saisie (sous l'id de la future IA). */
    const storeKey = async (): Promise<boolean> => {
      if (key.value.trim()) {
        try { await credSave(id, key.value); keySaved = true; key.value = ""; key.placeholder = "•••••••• (enregistrée)"; }
        catch (e) { res.set(`Impossible d'enregistrer la clé : ${String((e as any)?.message ?? e)}`, false); return false; }
      }
      if (p.secret === "required" && !keySaved) { res.set(`Colle d'abord ta ${p.secretLabel.toLowerCase()}.`, false); key.focus(); return false; }
      return true;
    };

    bList.onclick = async () => {
      bList.disabled = true;
      try {
        if (p.kind === "copilot") { res.set(`CLI détectée : ${await copilotCheck()}`, true); return; }
        if (!(await storeKey())) return;
        res.set("Recherche des modèles…", null);
        const d = draft();
        const names = await listModels(p.kind, id, d.baseUrl);
        dl.replaceChildren(...names.map((n) => { const o = el("option"); o.value = n; return o; }));
        if (!names.length) { res.set("Aucun modèle trouvé : saisis son nom à la main.", false); return; }
        if (!model.value.trim() || !names.includes(model.value.trim())) model.value = names.includes(p.defaultModel) ? p.defaultModel : names[0];
        res.set(`${names.length} modèle${names.length > 1 ? "s" : ""} disponible${names.length > 1 ? "s" : ""} : clique dans « Modèle » pour choisir.`, true);
        invalidate();
      } catch (e) { res.set(explainError({ ...draft(), name: shortName(p) }, e), false); host.react("fail"); }
      finally { bList.disabled = false; }
    };

    bTest.onclick = async () => {
      bTest.disabled = true;
      try {
        if (!(await storeKey())) return;
        const d = draft();
        if (p.kind === "openai" && !d.model) { res.set("Choisis un modèle (bouton « Lister les modèles »).", false); return; }
        setStep(2);
        res.set("Test en cours…", null);
        const reply = await testConnection(d);
        tested = true;
        res.set(`Ça marche : ${shortName(p)} répond « ${reply.slice(0, 60)} ».`, true);
        host.react("ok");
        renderFinish(d);
      } catch (e) {
        setStep(1);
        res.set(explainError(draft(), e), false);
        host.react("fail");
      } finally { bTest.disabled = false; }
    };

    function renderFinish(d: Connection) {
      setStep(3);
      finish.replaceChildren();
      const used = new Set((host.prefs.connections ?? []).map((c) => c.name.toLowerCase()));
      let name = d.name, n = 2;
      while (used.has(name.toLowerCase())) name = `${d.name} ${n++}`;
      const nameIn = input("text", name, "Nom affiché dans la barre");
      nameIn.maxLength = 24;
      const color = input("color", d.color);
      color.className = "color-input";
      color.title = "Couleur de cette IA (onglet et yeux de Lumo)";
      const caps = { ...d.caps };
      const capsBox = el("div");
      const drawCaps = () => capsBox.replaceChildren(capsRow(caps, { kind: d.kind, onChange: drawCaps }));
      drawCaps();
      const bAdd = el("button", "btn primary", "Ajouter à la barre");
      finish.append(
        field("Comment veux-tu l'appeler ?", nameIn, color),
        field("Ce que sait faire ce modèle", capsBox),
        bAdd,
      );
      nameIn.focus();
      nameIn.select();
      const add = () => {
        const final: Connection = { ...d, name: nameIn.value.trim() || d.name, color: color.value, caps };
        host.prefs.connections = [...(host.prefs.connections ?? []), final];
        host.prefs.active = final.id;
        host.save();
        keySaved = false; // la clé appartient maintenant à l'IA ajoutée
        host.react("added");
        host.connectionsChanged(final.id);
        void host.refreshKeys().then(() => renderSettings(box.closest(".view") as HTMLElement, host, { flash: final.id }));
      };
      bAdd.onclick = add;
      nameIn.onkeydown = (e) => { if (e.key === "Enter") add(); };
    }
  }
}

// ─── carte d'une IA existante ───────────────────────────────────────────────────
function connectionCard(c: Connection, root: HTMLElement, host: SettingsHost, flash: boolean): HTMLElement {
  const p = presetOf(c.preset);
  const card = el("details", "conn" + (flash ? " flash" : ""));
  card.style.setProperty("--pc", c.color);
  if (flash) card.open = false;

  const sum = el("summary");
  const dot = el("span", "dot");
  const title = el("span", "conn-title");
  title.append(el("strong", "", c.name), el("span", "muted small", `${shortName(p)}${c.model ? ` · ${c.model}` : ""}`));
  const hasKey = host.keys[c.id];
  const badge = el("span", hasKey ? "badge ok" : "badge", hasKey ? "Clé enregistrée" : p.secret === "optional" ? "Sans clé" : "Clé manquante");
  if (!hasKey && p.secret === "required") badge.classList.add("warn");
  sum.append(dot, title, capsRow(c.caps), badge);
  card.append(sum);

  const body = el("div", "conn-body");
  card.append(body);

  const name = input("text", c.name);
  name.maxLength = 24;
  const color = input("color", c.color);
  color.className = "color-input";
  body.append(field("Nom affiché", name, color));

  const url = input("text", c.baseUrl ?? "");
  if (c.kind === "openai") body.append(field("Adresse de l'API", url));

  const model = input("text", c.model, p.modelHint);
  const dl = el("datalist");
  dl.id = `models-${c.id}`;
  model.setAttribute("list", dl.id);
  const bList = el("button", "btn", c.kind === "copilot" ? "Vérifier la CLI" : "Lister les modèles");
  body.append(field("Modèle", model, bList), dl);

  const key = input("password", "", hasKey ? "•••••••• (laisser vide pour conserver)" : p.secretHint);
  body.append(field(p.secretLabel, key));

  const caps = { ...c.caps };
  const capsBox = el("div");
  const drawCaps = () => capsBox.replaceChildren(capsRow(caps, { kind: c.kind, onChange: drawCaps }));
  drawCaps();
  body.append(field("Ce que sait faire ce modèle", capsBox));
  model.addEventListener("change", () => { Object.assign(caps, guessCaps(c.preset, model.value.trim())); drawCaps(); });

  const res = resultLine();
  const row = el("div", "btn-row");
  const bSave = el("button", "btn primary", "Enregistrer");
  const bTest = el("button", "btn", "Tester");
  const bDel = el("button", "btn danger");
  bDel.innerHTML = `${ICON.trash}<span>Supprimer</span>`;
  row.append(bSave, bTest, bDel);
  body.append(row, res.el);

  const current = (): Connection => ({
    ...c, name: name.value.trim() || c.name, color: color.value, model: model.value.trim(),
    baseUrl: c.kind === "openai" ? url.value.trim() : undefined, caps: { ...caps },
  });
  const persist = async (): Promise<Connection | null> => {
    if (key.value.trim()) {
      try { await credSave(c.id, key.value); key.value = ""; }
      catch (e) { res.set(`Impossible d'enregistrer la clé : ${String((e as any)?.message ?? e)}`, false); return null; }
    }
    const next = current();
    host.prefs.connections = (host.prefs.connections ?? []).map((x) => (x.id === c.id ? next : x));
    Object.assign(c, next);
    host.save();
    host.connectionsChanged();
    await host.refreshKeys();
    return next;
  };

  bSave.onclick = async () => {
    if (await persist()) { host.react("saved"); await renderSettings(root, host); }
  };
  bTest.onclick = async () => {
    bTest.disabled = true;
    res.set("Test en cours…", null);
    try {
      const next = await persist();
      if (!next) return;
      const reply = await testConnection(next);
      res.set(`${next.name} répond : « ${reply.slice(0, 60)} »`, true);
      host.react("ok");
    } catch (e) { res.set(explainError(current(), e), false); host.react("fail"); }
    finally { bTest.disabled = false; }
  };
  bList.onclick = async () => {
    bList.disabled = true;
    try {
      if (c.kind === "copilot") { res.set(`CLI détectée : ${await copilotCheck()}`, true); return; }
      if (key.value.trim()) { await credSave(c.id, key.value); key.value = ""; }
      res.set("Recherche des modèles…", null);
      const names = await listModels(c.kind, c.id, c.kind === "openai" ? url.value.trim() : undefined);
      dl.replaceChildren(...names.map((n) => { const o = el("option"); o.value = n; return o; }));
      res.set(names.length ? `${names.length} modèle${names.length > 1 ? "s" : ""} : clique dans « Modèle » pour choisir, puis Enregistrer.` : "Aucun modèle trouvé.", !!names.length);
    } catch (e) { res.set(explainError(current(), e), false); }
    finally { bList.disabled = false; }
  };
  let armed = 0;
  bDel.onclick = async () => {
    if (!armed) {
      bDel.querySelector("span")!.textContent = "Confirmer la suppression";
      armed = window.setTimeout(() => { armed = 0; bDel.querySelector("span")!.textContent = "Supprimer"; }, 4000);
      return;
    }
    clearTimeout(armed);
    await credDelete(c.id).catch(() => {});
    host.prefs.connections = (host.prefs.connections ?? []).filter((x) => x.id !== c.id);
    if (host.prefs.active === c.id) host.prefs.active = host.prefs.connections[0]?.id ?? "";
    host.save();
    host.react("deleted");
    host.connectionsChanged();
    await host.refreshKeys();
    await renderSettings(root, host);
  };
  return card;
}

// ─── accès à internet ───────────────────────────────────────────────────────────
function webPanel(host: SettingsHost): HTMLElement {
  const { prefs } = host;
  const panel = el("section", "panel web-panel" + (prefs.web ? " on" : ""));
  const head = el("div", "web-head");
  const globe = el("span", "web-globe");
  globe.innerHTML = ICON.globe;
  const txt = el("div", "web-txt");
  txt.append(el("h3", "", "Accès à internet"), el("span", "muted small", "Les IA peuvent chercher sur le web et lire des pages, et citer leurs sources. Par défaut, seulement quand tu le demandes."));
  const sw = el("label", "switch");
  const cb = input("checkbox");
  cb.checked = prefs.web;
  sw.append(cb, el("span", "slider"));
  sw.title = "Activer / couper l'accès à internet";
  head.append(globe, txt, sw);
  panel.append(head);

  const body = el("div", "web-body");
  panel.append(body);
  cb.onchange = () => {
    prefs.web = cb.checked;
    host.save();
    panel.classList.toggle("on", prefs.web);
    host.onWeb();
    host.react(prefs.web ? "ok" : "deleted");
  };

  const how = el("ul", "web-how small");
  [
    ["Claude", "utilise la recherche web d'Anthropic (à activer dans la console Anthropic si ton organisation l'a désactivée ; sinon Lumo cherche à sa place)."],
    ["Gemini", "utilise la recherche Google intégrée (sauf les modèles qui génèrent des images)."],
    ["ChatGPT, Mistral, Groq, OpenRouter, DeepSeek", "appellent les outils de Lumo : « chercher » et « lire une page »."],
    ["Copilot et IA locales", "Lumo cherche d'abord, puis leur transmet les résultats avec ta question."],
  ].forEach(([who, what]) => { const li = el("li"); li.append(el("strong", "", who), ` ${what}`); how.append(li); });
  const modeSel = el("select");
  for (const [v, t] of [["ask", "Seulement quand je le demande (recommandé)"], ["auto", "L'IA décide (cherche dès qu'elle le juge utile)"]]) { const o = el("option", "", t); o.value = v; modeSel.append(o); }
  modeSel.value = prefs.webMode;
  const modeNote = el("p", "muted small");
  const drawMode = () => modeNote.textContent = prefs.webMode === "ask"
    ? "Pour demander : clique sur le globe 🌐 de la barre avant d'envoyer, écris « cherche sur internet… » / « /web … », ou colle un lien."
    : "Le globe de la barre reste allumé : l'IA peut chercher à chaque message (réponses un peu plus lentes).";
  drawMode();
  modeSel.onchange = () => { prefs.webMode = modeSel.value as "ask" | "auto"; host.save(); drawMode(); host.onWeb(); };
  body.append(field("Quand chercher sur internet", modeSel), modeNote, how);

  const engineSel = el("select");
  for (const e of ENGINES) { const o = el("option", "", e.label); o.value = e.id; engineSel.append(o); }
  engineSel.value = prefs.webEngine;
  const note = el("p", "muted small");
  const keyIn = input("password");
  const keyField = field("Clé API du moteur", keyIn);
  const res = resultLine();
  const bTest = el("button", "btn", "Tester la recherche");
  const bSaveKey = el("button", "btn primary", "Enregistrer la clé");
  const row = el("div", "btn-row");
  row.append(bTest, bSaveKey);

  const engine = () => ENGINES.find((e) => e.id === engineSel.value)!;
  const refresh = async () => {
    const e = engine();
    note.replaceChildren(e.note);
    if (e.keyUrl) {
      const a = el("a", "link", " Obtenir une clé");
      a.href = e.keyUrl;
      a.onclick = (ev) => { ev.preventDefault(); void openUrl(e.keyUrl!); };
      note.append(a);
    }
    const needsKey = e.id !== "duckduckgo";
    keyField.hidden = !needsKey;
    bSaveKey.hidden = !needsKey;
    if (needsKey) {
      const has = (await credStatus([`search-${e.id}`]).catch(() => ({} as Record<string, boolean>)))[`search-${e.id}`];
      keyIn.placeholder = has ? "•••••••• (enregistrée — laisser vide pour conserver)" : "colle ta clé ici";
    }
  };
  engineSel.onchange = () => { prefs.webEngine = engineSel.value as Engine; host.save(); res.set("", null); void refresh(); };
  bSaveKey.onclick = async () => {
    if (!keyIn.value.trim()) { res.set("Colle d'abord la clé.", false); return; }
    try { await credSave(`search-${engine().id}`, keyIn.value); keyIn.value = ""; res.set("Clé enregistrée.", true); host.react("saved"); void refresh(); }
    catch (e) { res.set(`Impossible d'enregistrer la clé : ${String((e as any)?.message ?? e)}`, false); }
  };
  bTest.onclick = async () => {
    bTest.disabled = true;
    res.set("Recherche « actualité du jour »…", null);
    try {
      if (keyIn.value.trim()) { await credSave(`search-${engine().id}`, keyIn.value); keyIn.value = ""; void refresh(); }
      const list = await search("actualité du jour", prefs.webEngine, 3);
      if (!list.length) { res.set("Le moteur n'a renvoyé aucun résultat.", false); host.react("fail"); return; }
      res.set(`Ça marche : ${list.map((r) => r.title).slice(0, 3).join(" · ")}`, true);
      host.react("ok");
    } catch (e) { res.set(String((e as any)?.message ?? e), false); host.react("fail"); }
    finally { bTest.disabled = false; }
  };
  void refresh();
  body.append(field("Moteur de recherche utilisé par Lumo", engineSel), note, keyField, row, res.el);
  return panel;
}

// ─── mémoire partagée ───────────────────────────────────────────────────────────
function memoryPanel(host: SettingsHost): HTMLElement {
  const { prefs } = host;
  const panel = el("section", "panel web-panel mem-panel" + (prefs.memory ? " on" : ""));
  const head = el("div", "web-head");
  const ico = el("span", "web-globe");
  ico.innerHTML = ICON.brain;
  const txt = el("div", "web-txt");
  const count = el("span", "badge");
  const h = el("h3", "", "Mémoire ");
  h.append(count);
  txt.append(h, el("span", "muted small", "Lumo se souvient de toi d'une conversation à l'autre. La mémoire est partagée par toutes tes IA : ce que tu dis à Claude, Gemini le sait aussi."));
  const sw = el("label", "switch");
  const cb = input("checkbox");
  cb.checked = prefs.memory;
  sw.append(cb, el("span", "slider"));
  head.append(ico, txt, sw);
  panel.append(head);
  cb.onchange = () => { prefs.memory = cb.checked; host.save(); panel.classList.toggle("on", prefs.memory); host.react(prefs.memory ? "ok" : "deleted"); };

  const body = el("div", "web-body");
  panel.append(body);
  body.append(el("p", "muted small", "Pour lui faire retenir quelque chose : « retiens que je préfère les réponses courtes ». Pour oublier : « oublie que… ». Les IA retiennent aussi d'elles-mêmes les informations durables (métier, préférences, projets). Jamais de mots de passe ni de clés."));

  const list = el("div", "mem-list");
  const draw = () => {
    const memos = allMemos();
    count.textContent = `${memos.length}`;
    list.replaceChildren();
    if (!memos.length) { list.append(el("div", "conn-empty", "Aucun souvenir pour l'instant.")); return; }
    for (const m of [...memos].reverse()) {
      const row = el("div", "mem-row");
      const t = input("text", m.text);
      t.className = "mem-text";
      t.title = `Retenu le ${new Date(m.at).toLocaleDateString("fr-FR")}${m.by ? ` par ${m.by}` : ""} — modifie le texte puis Entrée`;
      t.onchange = () => updateMemo(m.id, t.value);
      t.onkeydown = (e) => { if (e.key === "Enter") t.blur(); };
      const meta = el("span", "mem-meta muted small", `${new Date(m.at).toLocaleDateString("fr-FR")}${m.by ? ` · ${m.by}` : ""}`);
      const del = el("button", "icon-btn");
      del.innerHTML = ICON.x;
      del.title = "Oublier";
      del.onclick = () => removeMemo(m.id);
      row.append(t, meta, del);
      list.append(row);
    }
  };
  const off = onMemoryChange(draw);
  // la vue est reconstruite à chaque ouverture : on se désabonne quand le panneau disparaît
  const obs = new MutationObserver(() => { if (!panel.isConnected) { off(); obs.disconnect(); } });
  setTimeout(() => panel.parentElement && obs.observe(panel.closest(".view") ?? document.body, { childList: true, subtree: true }), 0);
  draw();

  const addIn = input("text", "", "Ajouter un souvenir (ex. « Romain travaille chez DoIt Consulting »)");
  const bAdd = el("button", "btn primary", "Ajouter");
  const doAdd = () => { if (addMemo(addIn.value, "toi")) { addIn.value = ""; host.react("saved"); } };
  bAdd.onclick = doAdd;
  addIn.onkeydown = (e) => { if (e.key === "Enter") doAdd(); };
  const where = el("p", "muted small");
  void memoryLocation().then((p) => where.textContent = `Fichier : ${p}`);
  const bClear = el("button", "btn danger", "Tout oublier");
  let armed = 0;
  bClear.onclick = () => {
    if (!armed) { bClear.textContent = "Confirmer : tout oublier"; armed = window.setTimeout(() => { armed = 0; bClear.textContent = "Tout oublier"; }, 4000); return; }
    clearTimeout(armed); armed = 0; bClear.textContent = "Tout oublier";
    clearMemory(); host.react("deleted");
  };
  const row = el("div", "btn-row");
  row.append(bClear);
  body.append(field("Nouveau souvenir", addIn, bAdd), list, row, where);
  return panel;
}
